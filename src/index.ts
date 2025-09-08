/// <reference path="../worker-configuration.d.ts" />
import type { ExportedHandler, ExecutionContext, Queue, MessageBatch } from '@cloudflare/workers-types';
import { Sensemaker, OpenRouterModel, SummarizationType, VoteTally } from 'sensemaking-tools';
import type { Comment, Topic } from 'sensemaking-tools';
import { parseCSVFile, parseTopicsString } from './utils/sensemake_openrouter_utils';
import { parseJSONFile } from './utils/parseJSON';

/**
 * Sensemaker Backend API with Queue Support
 * 
 * 支持的路由:
 * - GET /api/test: 健康檢查
 * - POST /api/sensemake: 智能分析評論數據（使用 Queue 異步處理）
 * - GET /api/sensemake/result/:taskId: 獲取處理結果
 * - POST /api/test-llm: 簡單的 LLM 測試
 * - POST /api/test-csv: CSV 解析測試
 * 
 * Queue Consumer:
 * - 處理 sensemake 任務，不受前端連線影響
 * - 支援自動重試和錯誤處理
 * 
 * 使用方法:
 * - 本地開發: npm run dev
 * - 部署: npm run deploy
 */

interface Env {
	OPENROUTER_API_KEY: string;
	OPENROUTER_BASE_URL: string;
	OPENROUTER_MODEL: string;
	IS_DEVELOPMENT?: string;
	SENSEMAKER_RESULTS: R2Bucket;
	SENSEMAKER_QUEUE: Queue;
}

// Queue 任務介面
interface SensemakeTask {
	taskId: string;
	comments: Comment[];
	openRouterApiKey: string;
	openRouterModel: string;
	additionalContext: string | null;
	outputLang: string;
	createdAt: string;
}

// 將各種格式的 voteInfo 轉為帶有 getTotalCount 的 VoteTally 相容物件
function toVoteTally(v: any): any {
  if (!v) return undefined;
  if (typeof v.getTotalCount === 'function') return v;
  const agree = v.agreeCount ?? v.agrees ?? v.agree ?? 0;
  const disagree = v.disagreeCount ?? v.disagrees ?? v.disagree ?? 0;
  const pass = v.passCount ?? v.passes ?? v.pass ?? 0;
  try {
    // 優先用套件的 VoteTally 類別
    return new (VoteTally as any)(agree, disagree, pass);
  } catch {
    // 後備：提供同名方法，避免下游呼叫失敗
    return {
      agreeCount: agree,
      disagreeCount: disagree,
      passCount: pass,
      getTotalCount: (includePass: boolean = true) => agree + disagree + (includePass ? pass : 0),
    };
  }
}

// 為 Queue 序列化準備的版本，只包含數值，不包含函數
function toVoteTallyForQueue(v: any): any {
  if (!v) return undefined;
  const agree = v.agreeCount ?? v.agrees ?? v.agree ?? 0;
  const disagree = v.disagreeCount ?? v.disagrees ?? v.disagree ?? 0;
  const pass = v.passCount ?? v.passes ?? v.pass ?? 0;
  
  return {
    agreeCount: agree,
    disagreeCount: disagree,
    passCount: pass,
    // 不包含函數，只包含數值
  };
}

function normalizeCommentsVoteInfo(comments: Comment[]): Comment[] {
  return comments.map((c: any) => {
    if (!c?.voteInfo) return c;
    
    // 創建新的物件，避免修改原始物件
    const newComment = { ...c };
    const vi = c.voteInfo;
    
    if (typeof vi === 'object' && vi !== null) {
      if (typeof vi.getTotalCount === 'function' || vi.constructor?.name === 'VoteTally') {
        return newComment; // 已是可用的 VoteTally
      }
      
      // 可能是群組 { groupA: {...}, groupB: {...} } 或單一 tally 物件
      const isGroup = Object.values(vi).every((x: any) => typeof x === 'object');
      if (isGroup) {
        newComment.voteInfo = Object.fromEntries(
          Object.entries(vi).map(([k, val]: any) => [k, toVoteTally(val)])
        );
      } else {
        newComment.voteInfo = toVoteTally(vi);
      }
    }
    
    return newComment;
  });
}

// 為 Queue 序列化準備的版本，移除所有函數
function normalizeCommentsForQueue(comments: Comment[]): Comment[] {
  return comments.map((c: any) => {
    if (!c?.voteInfo) return c;
    
    // 創建新的物件，避免修改原始物件
    const newComment = { ...c };
    const vi = c.voteInfo;
    
    if (typeof vi === 'object' && vi !== null) {
      if (typeof vi.getTotalCount === 'function' || vi.constructor?.name === 'VoteTally') {
        // 如果是 VoteTally 物件，轉換為純數值物件
        newComment.voteInfo = toVoteTallyForQueue(vi);
      } else {
        // 可能是群組 { groupA: {...}, groupB: {...} } 或單一 tally 物件
        const isGroup = Object.values(vi).every((x: any) => typeof x === 'object');
        if (isGroup) {
          newComment.voteInfo = Object.fromEntries(
            Object.entries(vi).map(([k, val]: any) => [k, toVoteTallyForQueue(val)])
          );
        } else {
          newComment.voteInfo = toVoteTallyForQueue(vi);
        }
      }
    }
    
    return newComment;
  });
}

const ALLOWED_ORIGINS = [
	'http://localhost:3000',
	'http://localhost:8787',
	'http://localhost:5173',
	'https://sensemaker-frontend.pages.dev',
	'https://sensemaker-backend.bestian123.workers.dev',
	'https://sensemaker.vtaiwan.tw',
];

// 開發環境的寬鬆 CORS 設置
function isOriginAllowed(origin: string, isDevelopment: boolean) {
	// 開發環境：允許所有 localhost 來源
	if (isDevelopment && origin.includes('localhost')) {
		return true;
	}
	
	// 生產環境：嚴格檢查允許的來源
	return ALLOWED_ORIGINS.includes(origin);
}

// 動態生成 CORS headers
function getCorsHeaders(origin: string, isDevelopment: boolean) {
	const isAllowed = isOriginAllowed(origin, isDevelopment);
	
	// 開發環境：允許所有 localhost 來源
	if (isDevelopment && origin.includes('localhost')) {
		return {
			'Access-Control-Allow-Origin': origin,
			'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Max-Age': '86400', // 24 hours
			'Vary': 'Origin',
		};
	}
	
	// 生產環境：嚴格控制
	return {
		'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
		'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		'Access-Control-Max-Age': '86400', // 24 hours
		'Vary': 'Origin',
	};
}

export default {
	// HTTP 請求處理
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const origin = request.headers.get('Origin');

		console.log('Request Origin:', origin);
		console.log('Request Method:', request.method);
		console.log('Request Path:', path);

		const isDevelopment = env.IS_DEVELOPMENT === 'true' || env.IS_DEVELOPMENT === undefined;
		const corsHeaders = getCorsHeaders(origin || '', isDevelopment);

		try {
			// 處理 CORS 預檢請求
			if (request.method === 'OPTIONS') {
				return new Response(null, {
					status: 200,
					headers: { ...corsHeaders }
				});
			}

			// 健康檢查端點
			if (path === '/api/test' && request.method === 'GET') {
				return new Response(
					JSON.stringify({
						status: 'ok',
						message: 'Sensemaker Backend with Queue is running',
						timestamp: new Date().toISOString(),
						environment: isDevelopment ? 'development' : 'production'
					}),
					{
						status: 200,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders
						}
					}
				);
			}

			// 獲取處理結果的端點
			if (path.startsWith('/api/sensemake/result/') && request.method === 'GET') {
				return await handleGetResultRequest(request, url, env, corsHeaders);
			}

			// 刪除任務報告的端點
			if (path.startsWith('/api/sensemake/delete/') && request.method === 'DELETE') {
				return await handleDeleteTaskRequest(request, url, env, corsHeaders);
			}

			// 簡單的 LLM 測試端點
			if (path === '/api/test-llm' && request.method === 'POST') {
				return await handleTestLLMRequest(request, env, corsHeaders);
			}

			// Sensemake API 端點
			if (path === '/api/sensemake' && request.method === 'POST') {
				return await handleSensemakeRequest(request, url, env, corsHeaders);
			}

			// CSV 解析測試端點
			if (path === '/api/test-csv' && request.method === 'POST') {
				return await handleTestCsvRequest(request, env, corsHeaders);
			}

			// JSON 解析測試端點
			if (path === '/api/test-json' && request.method === 'POST') {
				return await handleTestJsonRequest(request, env, corsHeaders);
			}

			// R2 讀寫測試端點
			if (path === '/api/test-r2' && request.method === 'POST') {
				return await handleTestR2Request(request, env, corsHeaders);
			}

			// 404 處理
			return new Response('Not Found', { 
				status: 404,
				headers: { ...corsHeaders }
			});

		} catch (error) {
			console.error('Error processing request:', error);
			return new Response(
				JSON.stringify({ 
					error: 'Internal Server Error', 
					message: error instanceof Error ? error.message : 'Unknown error' 
				}), 
				{ 
					status: 500, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}
	},

	// Queue Consumer - 處理背景任務
	async queue(batch: MessageBatch<SensemakeTask>, env: Env): Promise<void> {
		console.log(`Processing ${batch.messages.length} queue messages`);
		
		for (const message of batch.messages) {
			try {
				const task = message.body;
				console.log(`Processing queue task: ${task.taskId}`);
				
				// 更新任務狀態為處理中
				await updateTaskStatus(env, task.taskId, 'processing', 1);
				
				// 處理任務，重新創建可用的 VoteTally 物件
				await processSensemakeTask(
					task.taskId,
					normalizeCommentsVoteInfo(task.comments) as any,
					task.openRouterApiKey,
					task.openRouterModel,
					task.additionalContext,
					task.outputLang,
					env
				);
				
				// 標記消息為已處理
				message.ack();
				console.log(`Queue task ${task.taskId} completed successfully`);
				
			} catch (error) {
				console.error(`Error processing queue task:`, error);
				
				// 更新任務狀態為失敗
				try {
					await updateTaskStatus(env, message.body.taskId, 'failed', 1);
				} catch (statusError) {
					console.error(`Failed to update task status:`, statusError);
				}
				
				// 標記消息為失敗，讓 Queue 重試
				message.retry();
			}
		}
	}
};

/**
 * 處理 sensemake API 請求（使用 Queue 異步處理）
 */
async function handleSensemakeRequest(request: Request, url: URL, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
	
	console.log('OPENROUTER_API_KEY', env.OPENROUTER_API_KEY);
	console.log('OPENROUTER_MODEL', env.OPENROUTER_MODEL);
	
	// 解析查詢參數
	const openRouterApiKey = url.searchParams.get('OPENROUTER_API_KEY') || env.OPENROUTER_API_KEY;
	const openRouterModel = url.searchParams.get('OPENROUTER_API_KEY') ? (url.searchParams.get('OPENROUTER_MODEL') || env.OPENROUTER_MODEL) : env.OPENROUTER_MODEL;
	const additionalContext = url.searchParams.get('additionalContext') || url.searchParams.get('a');
	const outputLang = url.searchParams.get('output_lang') || 'en';

	// 檢查必需的 API 金鑰
	if (!openRouterApiKey) {
		return new Response(
			JSON.stringify({ 
				error: 'Missing API Key', 
				message: 'OPENROUTER_API_KEY parameter is required' 
			}), 
			{ 
				status: 400, 
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders,
				} 
			}
		);
	}

	try {
		// 解析請求體
		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return new Response(
				JSON.stringify({ 
					error: 'Missing File', 
					message: 'File upload is required' 
				}), 
				{ 
					status: 400, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}

		// 檢查文件類型
		const contentType = file.type;
		const fileName = file.name.toLowerCase();
		
		let comments: Comment[] = [];
		
		if (contentType === 'application/json' || fileName.endsWith('.json')) {
			comments = await parseJSONFile(file);
		} else if (contentType === 'text/csv' || fileName.endsWith('.csv')) {
			comments = await parseCSVFile(file);
		} else {
			return new Response(
				JSON.stringify({ 
					error: 'Unsupported File Type', 
					message: 'Only JSON and CSV files are supported' 
				}), 
				{ 
					status: 400, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}

		// 驗證評論數據
		if (comments.length === 0) {
			return new Response(
				JSON.stringify({ 
					error: 'No Valid Comments', 
					message: 'No valid comments found in the uploaded file' 
				}), 
				{ 
					status: 400, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}

		// 為 Queue 序列化準備，移除所有函數，只保留數值
		comments = normalizeCommentsForQueue(comments) as any;

		// 生成唯一的任務 ID
		const taskId = generateTaskId();
		console.log(`Starting task ${taskId} with ${comments.length} comments`);

		// 創建 Queue 任務
		const queueTask: SensemakeTask = {
			taskId,
			comments,
			openRouterApiKey,
			openRouterModel,
			additionalContext,
			outputLang,
			createdAt: new Date().toISOString()
		};

		// 將任務發送到 Queue
		await env.SENSEMAKER_QUEUE.send(queueTask);
		console.log(`Task ${taskId} queued successfully`);

		// 立即返回任務 ID，讓前端開始輪詢
		const response = new Response(
			JSON.stringify({
				success: true,
				taskId: taskId,
				message: 'Task queued successfully',
				commentsCount: comments.length,
				model: openRouterModel,
				status: 'queued',
				pollingUrl: `/api/sensemake/result/${taskId}`,
				estimatedTime: '10~30 minutes',
				note: 'Task is now being processed in the background queue'
			}),
			{
				status: 202, // Accepted
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders,
				}
			}
		);

		return response;

	} catch (error) {
		console.error('Error in sensemake request handling:', error);
		return new Response(
			JSON.stringify({ 
				error: 'Request Error', 
				message: error instanceof Error ? error.message : 'Unknown request error' 
			}), 
			{ 
				status: 500, 
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders,
				} 
			}
		);
	}
}

/**
 * 在背景中處理 sensemake 任務（Queue consumer 使用）
 */
async function processSensemakeTask(
	taskId: string,
	comments: Comment[],
	openRouterApiKey: string,
	openRouterModel: string,
	additionalContext: string | null,
	outputLang: string,
	env: Env
): Promise<void> {
	try {
		console.log(`Task ${taskId}: Starting processing...`);

		// 創建 OpenRouter 模型實例
		const model = new (OpenRouterModel as any)(openRouterApiKey, openRouterModel, env.OPENROUTER_BASE_URL);

		// 創建 Sensemaker 實例
		const sensemaker = new Sensemaker({
			defaultModel: model
		});

		// 學習主題
		console.log(`Task ${taskId}: Learning topics...`);
		const topics = await sensemaker.learnTopics(
			comments,
			true,
			undefined,
			additionalContext || undefined,
			2,
			outputLang as any
		);

		// 分類評論
		console.log(`Task ${taskId}: Categorizing comments...`);
		const categorizedComments = await sensemaker.categorizeComments(
			comments,
			true,
			topics,
			additionalContext || undefined,
			2,
			outputLang as any
		);

		// 生成摘要
		console.log(`Task ${taskId}: Generating summary...`);
		const summary = await sensemaker.summarize(
			categorizedComments,
			SummarizationType.AGGREGATE_VOTE,
			topics,
			additionalContext || undefined,
			outputLang as any
		);

		// 移除 TopicSummary 部分，只保留核心摘要內容
		const filteredSummary = summary.withoutContents((sc: any) => sc.type === 'TopicSummary');
		const markdownContent = filteredSummary.getText('MARKDOWN');

		// 將結果存儲到 R2
		const resultData = {
			taskId: taskId,
			status: 'completed',
			completedAt: new Date().toISOString(),
			model: openRouterModel,
			commentsProcessed: comments.length,
			additionalContext: additionalContext || null,
			outputLanguage: outputLang,
			summary: markdownContent
		};

		await env.SENSEMAKER_RESULTS.put(
			`${taskId}.json`,
			JSON.stringify(resultData, null, 2),
			{
				httpMetadata: { contentType: 'application/json' },
				customMetadata: {
					taskId: taskId,
					status: 'completed',
					completedAt: resultData.completedAt
				}
			}
		);

		console.log(`Task ${taskId}: Completed and stored to R2`);

	} catch (error) {
		console.error(`Task ${taskId}: Error during processing:`, error);

		// 存儲錯誤信息到 R2
		const errorData = {
			taskId: taskId,
			status: 'failed',
			failedAt: new Date().toISOString(),
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined
		};

		try {
			await env.SENSEMAKER_RESULTS.put(
				`${taskId}.json`,
				JSON.stringify(errorData, null, 2),
				{
					httpMetadata: { contentType: 'application/json' },
					customMetadata: {
						taskId: taskId,
						status: 'failed',
						failedAt: errorData.failedAt
					}
				}
			);
		} catch (storageError) {
			console.error(`Task ${taskId}: Failed to store error to R2:`, storageError);
		}

		throw error;
	}
}

/**
 * 簡單的 LLM 測試請求處理
 */
async function handleTestLLMRequest(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  console.log('=== TESTING LLM INTEGRATION ===');

  const testComment = { id: 'test-1', text: '這是一個測試評論，用來驗證 LLM 是否正常工作。' };
  console.log('Test comment:', testComment);

  const model = new (OpenRouterModel as any)(
    env.OPENROUTER_API_KEY,
    env.OPENROUTER_MODEL,
    env.OPENROUTER_BASE_URL
  );

  console.log('Model created with:', {
    apiKey: env.OPENROUTER_API_KEY ? '***' + env.OPENROUTER_API_KEY.slice(-4) : 'undefined',
    model: env.OPENROUTER_MODEL,
    baseURL: env.OPENROUTER_BASE_URL
  });

  try {
    const simpleResponse = await model.generateText(
      '請用繁體中文回答：這是一個測試，請回覆"測試成功"',
      'zh-TW'
    );

    let structuredResponse: any = null;
    let structuredError: string | null = null;
    try {
      structuredResponse = await model.generateData(
        '請分析這個評論的情感傾向，並用JSON格式回覆：{"sentiment": "positive/negative/neutral", "confidence": 0.9}',
        {
          type: 'object',
          properties: {
            sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          },
          required: ['sentiment', 'confidence']
        },
        'zh-TW'
      );
    } catch (error: any) {
      structuredError = error instanceof Error ? error.message : String(error);
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          message: 'LLM test completed',
          testComment,
          simpleResponse,
          structuredResponse,
          structuredError,
          timestamp: new Date().toISOString()
        },
        null,
        2
      ),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify(
        {
          success: false,
          message: 'LLM test failed',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        },
        null,
        2
      ),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}



/**
 * 處理獲取結果的請求
 */
async function handleGetResultRequest(request: Request, url: URL, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
	try {
		// 從 URL 路徑中提取任務 ID
		const pathParts = url.pathname.split('/');
		const taskId = pathParts[pathParts.length - 1];
		
		if (!taskId) {
			return new Response(
				JSON.stringify({ 
					error: 'Missing Task ID', 
					message: 'Task ID is required' 
				}), 
				{ 
					status: 400, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}

		console.log(`Fetching result for task: ${taskId}`);

		// 從 R2 中獲取結果
		const bucket = env.IS_DEVELOPMENT === 'true' ? env.SENSEMAKER_RESULTS : env.SENSEMAKER_RESULTS;
		const object = await bucket.get(`${taskId}.json`);

		if (!object) {
			return new Response(
				JSON.stringify({ 
					error: 'Task Not Found', 
					message: 'Task not found or still processing',
					taskId: taskId,
					status: 'not_found'
				}), 
				{ 
					status: 404, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}

		// 解析結果數據
		const resultData = JSON.parse(await object.text());
		
		if (resultData.status === 'failed') {
			return new Response(
				JSON.stringify({ 
					message: 'Task processing failed',
					taskId: taskId,
					status: 'failed',
					error: resultData.error,
					failedAt: resultData.failedAt
				}), 
				{ 
					status: 500, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}

		// 返回成功的結果
		return new Response(
			JSON.stringify({
				success: true,
				taskId: taskId,
				status: 'completed',
				completedAt: resultData.completedAt,
				model: resultData.model,
				commentsProcessed: resultData.commentsProcessed,
				additionalContext: resultData.additionalContext,
				outputLanguage: resultData.outputLanguage,
				summary: resultData.summary
			}),
			{
				status: 200,
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders,
				}
			}
		);

	} catch (error) {
		console.error('Error fetching result:', error);
		return new Response(
			JSON.stringify({ 
				error: 'Result Fetch Error', 
				message: error instanceof Error ? error.message : 'Unknown error fetching result' 
			}), 
			{ 
				status: 500, 
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders,
				} 
			}
		);
	}
}

/**
 * 處理刪除任務報告的請求
 */
async function handleDeleteTaskRequest(request: Request, url: URL, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
	try {
		// 從 URL 路徑中提取任務 ID
		const pathParts = url.pathname.split('/');
		const taskId = pathParts[pathParts.length - 1];
		
		if (!taskId) {
			return new Response(
				JSON.stringify({ 
					error: 'Missing Task ID', 
					message: 'Task ID is required' 
				}), 
				{ 
					status: 400, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}

		console.log(`Deleting task report: ${taskId}`);

		// 從 R2 中刪除結果
		const bucket = env.IS_DEVELOPMENT === 'true' ? env.SENSEMAKER_RESULTS : env.SENSEMAKER_RESULTS;
		
		// 檢查文件是否存在
		const object = await bucket.get(`${taskId}.json`);
		if (!object) {
			return new Response(
				JSON.stringify({ 
					error: 'Task Not Found', 
					message: 'Task report not found',
					taskId: taskId,
					status: 'not_found'
				}), 
				{ 
					status: 404, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}

		// 刪除文件
		await bucket.delete(`${taskId}.json`);
		// 同時刪除狀態文件（如果存在）
		try {
			await bucket.delete(`${taskId}-status.json`);
		} catch (statusError) {
			// 狀態文件可能不存在，忽略錯誤
			console.log(`Status file ${taskId}-status.json not found or already deleted`);
		}
		console.log(`Task report ${taskId} deleted successfully`);

		// 返回成功響應
		return new Response(
			JSON.stringify({
				success: true,
				message: 'Task report deleted successfully',
				taskId: taskId
			}),
			{
				status: 200,
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders,
				}
			}
		);

	} catch (error) {
		console.error('Error deleting task report:', error);
		return new Response(
			JSON.stringify({ 
				error: 'Delete Error', 
				message: error instanceof Error ? error.message : 'Unknown error deleting task report' 
			}), 
			{ 
				status: 500, 
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders,
				} 
			}
		);
	}
}

/**
 * 生成唯一的任務 ID
 */
function generateTaskId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 15);
	return `task-${timestamp}-${random}`;
}



/**
 * 處理 JSON 解析測試請求
 */
async function handleTestJsonRequest(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
	try {
		// 解析請求體
		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return new Response(
				JSON.stringify({ 
					error: 'Missing File', 
					message: 'No file provided in the request' 
				}), 
				{ 
					status: 400, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}

		// 檢查文件類型
		if (!file.name.endsWith('.json')) {
			return new Response(
				JSON.stringify({ 
					error: 'Invalid File Type', 
					message: 'Only JSON files are supported for this test endpoint' 
				}), 
				{ 
					status: 400, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}

		console.log('=== JSON 解析測試開始 ===');
		console.log('文件名:', file.name);
		console.log('文件大小:', file.size, 'bytes');

		// 解析 JSON 文件
		const comments = await parseJSONFile(file);
		
		// 標準化 voteInfo，確保具備可用的 VoteTally 物件
		const normalizedComments = normalizeCommentsVoteInfo(comments);
		
		console.log('=== JSON 解析結果 ===');
		console.log('解析的評論數量:', comments.length);
		console.log('標準化後的評論數量:', normalizedComments.length);
		
		// 調試：檢查第一個評論的 voteInfo 結構
		if (normalizedComments.length > 0) {
			const firstComment = normalizedComments[0];
			console.log('第一個評論的 voteInfo:', {
				hasVoteInfo: !!firstComment.voteInfo,
				voteInfoType: typeof firstComment.voteInfo,
				voteInfoKeys: firstComment.voteInfo ? Object.keys(firstComment.voteInfo) : [],
				hasGetTotalCount: firstComment.voteInfo ? typeof (firstComment.voteInfo as any).getTotalCount === 'function' : false,
				agreeCount: firstComment.voteInfo ? (firstComment.voteInfo as any).agreeCount : 'undefined',
				disagreeCount: firstComment.voteInfo ? (firstComment.voteInfo as any).disagreeCount : 'undefined',
				passCount: firstComment.voteInfo ? (firstComment.voteInfo as any).passCount : 'undefined'
			});
		}
		
		// 詳細記錄每個評論的投票信息
		normalizedComments.forEach((comment, index) => {
			console.log(`評論 ${index + 1}:`, {
				id: comment.id,
				text: comment.text?.substring(0, 50) + '...',
				hasVoteInfo: !!comment.voteInfo,
				voteInfoType: typeof comment.voteInfo,
				voteInfoKeys: comment.voteInfo ? Object.keys(comment.voteInfo) : []
			});
			
			if (comment.voteInfo) {
				// 檢查是否為群組投票格式（對象有多個鍵）還是簡單投票格式
				const hasVoteCounts = 'agreeCount' in comment.voteInfo && 'disagreeCount' in comment.voteInfo && 'passCount' in comment.voteInfo;
				
				if (hasVoteCounts) {
					// 簡單投票格式（包含 agreeCount, disagreeCount, passCount）
					const voteData = comment.voteInfo as any;
					console.log(`  簡單投票:`, {
						agreeCount: voteData.agreeCount,
						disagreeCount: voteData.disagreeCount,
						passCount: voteData.passCount,
						totalCount: voteData.getTotalCount ? voteData.getTotalCount(true) : 'N/A',
						hasGetTotalCount: !!voteData.getTotalCount,
						constructor: voteData.constructor?.name || 'Unknown'
					});
				} else {
					// 群組投票格式（對象有多個鍵，每個鍵都是投票資料）
					Object.entries(comment.voteInfo).forEach(([key, voteData]) => {
						console.log(`  群組 ${key}:`, {
							agreeCount: (voteData as any).agreeCount,
							disagreeCount: (voteData as any).disagreeCount,
							passCount: (voteData as any).passCount,
							totalCount: (voteData as any).getTotalCount ? (voteData as any).getTotalCount(true) : 'N/A',
							hasGetTotalCount: !!(voteData as any).getTotalCount,
							constructor: (voteData as any).constructor?.name || 'Unknown'
						});
					});
				}
			}
		});

		// 返回詳細的解析結果
		return new Response(
			JSON.stringify({
				success: true,
				fileName: file.name,
				fileSize: file.size,
				commentsCount: normalizedComments.length,
				comments: normalizedComments.map(comment => ({
					id: comment.id,
					text: comment.text,
					voteInfo: comment.voteInfo ? (() => {
						// 直接使用標準化後的 voteInfo，它應該已經有正確的結構
						const voteData = comment.voteInfo as any;
						
						// 檢查是否有 getTotalCount 方法
						if (typeof voteData.getTotalCount === 'function') {
							return {
								agreeCount: voteData.agreeCount,
								disagreeCount: voteData.disagreeCount,
								passCount: voteData.passCount,
								totalCount: voteData.getTotalCount(true),
								hasGetTotalCount: true
							};
						} else {
							// 如果沒有 getTotalCount 方法，可能是群組格式
							return Object.fromEntries(
								Object.entries(comment.voteInfo).map(([key, voteData]) => [
									key,
									{
										agreeCount: (voteData as any).agreeCount,
										disagreeCount: (voteData as any).disagreeCount,
										passCount: (voteData as any).passCount,
										totalCount: (voteData as any).getTotalCount ? (voteData as any).getTotalCount(true) : 'N/A',
										hasGetTotalCount: !!(voteData as any).getTotalCount
									}
								])
							);
						}
					})() : undefined
				})),
				debug: {
					lastModified: file.lastModified,
					type: file.type
				}
			}, null, 2),
			{
				status: 200,
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders,
				}
			}
		);

	} catch (error) {
		console.error('Error in JSON test processing:', error);
		return new Response(
			JSON.stringify({ 
				error: 'JSON Test Error', 
				message: error instanceof Error ? error.message : 'Unknown JSON test error',
				stack: error instanceof Error ? error.stack : undefined
			}), 
			{ 
				status: 500, 
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders,
				} 
			}
		);
	}
}

/**
 * 處理 CSV 解析測試請求
 */
async function handleTestCsvRequest(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
	try {
		// 解析請求體
		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return new Response(
				JSON.stringify({ 
					error: 'Missing File', 
					message: 'No file provided in the request' 
				}), 
				{ 
					status: 400, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}

		// 檢查文件類型
		if (!file.name.endsWith('.csv')) {
			return new Response(
				JSON.stringify({ 
					error: 'Invalid File Type', 
					message: 'Only CSV files are supported for this test endpoint' 
				}), 
				{ 
					status: 400, 
					headers: { 
						'Content-Type': 'application/json',
						...corsHeaders,
					} 
				}
			);
		}

		console.log('=== CSV 解析測試開始 ===');
		console.log('文件名:', file.name);
		console.log('文件大小:', file.size, 'bytes');

		// 解析 CSV 文件
		const comments = await parseCSVFile(file);
		
		console.log('=== CSV 解析結果 ===');
		console.log('解析的評論數量:', comments.length);
		
		// 詳細記錄每個評論的投票信息
		comments.forEach((comment, index) => {
			console.log(`評論 ${index + 1}:`, {
				id: comment.id,
				text: comment.text?.substring(0, 50) + '...',
				hasVoteInfo: !!comment.voteInfo,
				voteInfoType: typeof comment.voteInfo,
				voteInfoKeys: comment.voteInfo ? Object.keys(comment.voteInfo) : []
			});
			
			if (comment.voteInfo) {
				// 檢查是否為群組投票格式（對象有多個鍵）還是簡單投票格式（直接是 VoteTally 對象）
				if (comment.voteInfo.constructor?.name === 'VoteTally') {
					// 簡單投票格式
					const voteData = comment.voteInfo as any;
					console.log(`  簡單投票:`, {
						agreeCount: voteData.agreeCount,
						disagreeCount: voteData.disagreeCount,
						passCount: voteData.passCount,
						totalCount: voteData.getTotalCount ? voteData.getTotalCount(true) : 'N/A',
						hasGetTotalCount: !!voteData.getTotalCount,
						constructor: voteData.constructor?.name || 'Unknown'
					});
				} else {
					// 群組投票格式
					Object.entries(comment.voteInfo).forEach(([key, voteData]) => {
						console.log(`  群組 ${key}:`, {
							agreeCount: voteData.agreeCount,
							disagreeCount: voteData.disagreeCount,
							passCount: voteData.passCount,
							totalCount: voteData.getTotalCount ? voteData.getTotalCount(true) : 'N/A',
							hasGetTotalCount: !!voteData.getTotalCount,
							constructor: voteData.constructor?.name || 'Unknown'
						});
					});
				}
			}
		});

		// 返回詳細的解析結果
		return new Response(
			JSON.stringify({
				success: true,
				fileName: file.name,
				fileSize: file.size,
				commentsCount: comments.length,
				comments: comments.map(comment => ({
					id: comment.id,
					text: comment.text,
					voteInfo: comment.voteInfo ? (() => {
						// 檢查是否為群組投票格式還是簡單投票格式
						const hasVoteCounts = 'agreeCount' in comment.voteInfo && 'disagreeCount' in comment.voteInfo && 'passCount' in comment.voteInfo;
						
						if (hasVoteCounts) {
							// 簡單投票格式（包含 agreeCount, disagreeCount, passCount）
							const voteData = comment.voteInfo as any;
							return {
								agreeCount: voteData.agreeCount,
								disagreeCount: voteData.disagreeCount,
								passCount: voteData.passCount,
								totalCount: voteData.getTotalCount ? voteData.getTotalCount(true) : 'N/A',
								hasGetTotalCount: !!voteData.getTotalCount,
								getTotalCount: voteData.getTotalCount
							};
						} else {
							// 群組投票格式（對象有多個鍵，每個鍵都是投票資料）
							return Object.fromEntries(
								Object.entries(comment.voteInfo).map(([key, voteData]) => [
									key,
									{
										agreeCount: (voteData as any).agreeCount,
										disagreeCount: (voteData as any).disagreeCount,
										passCount: (voteData as any).passCount,
										totalCount: (voteData as any).getTotalCount ? (voteData as any).getTotalCount(true) : 'N/A',
										hasGetTotalCount: !!(voteData as any).getTotalCount,
										getTotalCount: (voteData as any).getTotalCount
									}
								])
							);
						}
					})() : undefined
				})),
				debug: {
					lastModified: file.lastModified,
					type: file.type
				}
			}, null, 2),
			{
				status: 200,
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders,
				}
			}
		);

	} catch (error) {
		console.error('Error in CSV test processing:', error);
		return new Response(
			JSON.stringify({ 
				error: 'CSV Test Error', 
				message: error instanceof Error ? error.message : 'Unknown CSV test error',
				stack: error instanceof Error ? error.stack : undefined
			}), 
			{ 
				status: 500, 
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders,
				} 
			}
		);
	}
}

/**
 * 處理 R2 讀寫測試請求
 */
async function handleTestR2Request(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
	try {
		const bucket = env.IS_DEVELOPMENT === 'true' ? env.SENSEMAKER_RESULTS : env.SENSEMAKER_RESULTS;
		const testKey = 'test-r2-key';
		const testValue = 'test-r2-value';

		console.log('=== R2 讀寫測試開始 ===');
		console.log('測試鍵:', testKey);
		console.log('測試值:', testValue);

		// 寫入數據
		await bucket.put(testKey, testValue, {
			httpMetadata: {
				contentType: 'text/plain',
			},
			customMetadata: {
				test: 'write-test'
			}
		});
		console.log('數據已寫入 R2');

		// 讀取數據
		const object = await bucket.get(testKey);
		if (object) {
			const readValue = await object.text();
			console.log('從 R2 讀取的值:', readValue);
			return new Response(
				JSON.stringify({
					success: true,
					message: 'R2 write and read test completed',
					readValue: readValue,
					customMetadata: object.customMetadata
				}),
				{
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders,
					}
				}
			);
		} else {
			return new Response(
				JSON.stringify({
					success: false,
					message: 'Failed to read data from R2',
					taskId: testKey,
					status: 'not_found'
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders,
					}
				}
			);
		}

	} catch (error) {
		console.error('Error in R2 test processing:', error);
		return new Response(
			JSON.stringify({ 
				error: 'R2 Test Error', 
				message: error instanceof Error ? error.message : 'Unknown R2 test error',
				stack: error instanceof Error ? error.stack : undefined
			}), 
			{ 
				status: 500, 
				headers: { 
					'Content-Type': 'application/json',
					...corsHeaders,
				} 
			}
		);
	}
}

/**
 * 更新任務狀態到 R2
 */
async function updateTaskStatus(env: Env, taskId: string, status: string, attempt: number, progress?: string): Promise<void> {
	try {
		const statusData = {
			taskId: taskId,
			status: status,
			lastUpdated: new Date().toISOString(),
			attempt: attempt,
			progress: progress || 'unknown'
		};

		const bucket = env.SENSEMAKER_RESULTS;
		await bucket.put(
			`${taskId}-status.json`,
			JSON.stringify(statusData, null, 2),
			{
				httpMetadata: {
					contentType: 'application/json',
				},
				customMetadata: {
					taskId: taskId,
					status: status,
					lastUpdated: statusData.lastUpdated
				}
			}
		);
	} catch (error) {
		console.error(`Task ${taskId}: Failed to update status:`, error);
		// 不拋出錯誤，避免影響主要任務
	}
}
