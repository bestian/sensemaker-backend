/// <reference path="../worker-configuration.d.ts" />
import type { ExportedHandler, ExecutionContext } from '@cloudflare/workers-types';
import { Sensemaker, OpenRouterModel, SummarizationType, VoteTally } from 'sensemaking-tools';
import type { Comment, Topic } from 'sensemaking-tools';
import { parseCSVFile, parseTopicsString } from './utils/sensemake_openrouter_utils';

/**
 * Sensemaker Backend API
 * 
 * 支持的路由:
 * - GET /api/test: 健康檢查
 * - POST /api/sensemake: 智能分析評論數據
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
}

const ALLOWED_ORIGINS = [
	'http://localhost:3000',
	'http://localhost:8787',
	'http://localhost:5173',
	'https://sensemaker-frontend.pages.dev',
];

// 開發環境的寬鬆 CORS 設置
// 可以根據環境變數設置，預設為 true

// 檢查來源是否被允許
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
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Max-Age': '86400', // 24 hours
			'Vary': 'Origin', // 重要：告訴快取這個回應會根據 Origin 而變化
		};
	}
	
	// 生產環境：嚴格控制
	return {
		'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		'Access-Control-Max-Age': '86400', // 24 hours
		'Vary': 'Origin', // 重要：告訴快取這個回應會根據 Origin 而變化
	};
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const origin = request.headers.get('Origin');

		// 調試 CORS 信息
		console.log('Request Origin:', origin);
		console.log('Request Method:', request.method);
		console.log('Request Path:', path);

		// 檢查是否為開發環境
		const isDevelopment = env.IS_DEVELOPMENT === 'true' || env.IS_DEVELOPMENT === undefined;
		
		const corsHeaders = getCorsHeaders(origin || '', isDevelopment);
		console.log('CORS Headers:', corsHeaders);

		try {
			// 處理 CORS 預檢請求
			if (request.method === 'OPTIONS') {
				return new Response(null, {
					status: 200,
					headers: {
						...corsHeaders,
					}
				});
			}

			// 健康檢查端點
			if (path === '/api/test' && request.method === 'GET') {
				return new Response(
					JSON.stringify({
						status: 'ok',
						message: 'Sensemaker Backend is running',
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

			// 簡單的 LLM 測試端點
			if (path === '/api/test-llm' && request.method === 'POST') {
				console.log('=== TESTING LLM INTEGRATION ===');
				
				// 創建一個簡單的測試評論
				const testComment = {
					id: 'test-1',
					text: '這是一個測試評論，用來驗證 LLM 是否正常工作。'
				};
				
				console.log('Test comment:', testComment);
				
				// 創建 OpenRouter 模型實例
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
					// 測試簡單的文本生成
					console.log('Testing simple text generation...');
					const simpleResponse = await model.generateText(
						'請用繁體中文回答：這是一個測試，請回覆"測試成功"',
						'zh-TW'
					);
					console.log('Simple text response:', simpleResponse);
					
					// 測試結構化數據生成
					console.log('Testing structured data generation...');
					let structuredResponse = null;
					let structuredError = null;
					
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
						console.log('Structured response:', structuredResponse);
					} catch (error) {
						console.error('Structured data generation failed:', error);
						structuredError = error instanceof Error ? error.message : String(error);
					}
					
					return new Response(
						JSON.stringify({
							success: true,
							message: 'LLM test completed',
							testComment: testComment,
							simpleResponse: simpleResponse,
							structuredResponse: structuredResponse,
							structuredError: structuredError,
							timestamp: new Date().toISOString()
						}, null, 2),
						{
							status: 200,
							headers: {
								'Content-Type': 'application/json',
								...corsHeaders
							}
						}
					);
					
				} catch (error) {
					console.error('LLM test failed:', error);
					return new Response(
						JSON.stringify({
							success: false,
							message: 'LLM test failed',
							error: error instanceof Error ? error.message : String(error),
							timestamp: new Date().toISOString()
						}, null, 2),
						{
							status: 500,
							headers: {
								'Content-Type': 'application/json',
								...corsHeaders
							}
						}
					);
				}
			}

			// Sensemake API 端點
			if (path === '/api/sensemake' && request.method === 'POST') {
				return await handleSensemakeRequest(request, url, env, corsHeaders);
			}

			// CSV 解析測試端點
			if (path === '/api/test-csv' && request.method === 'POST') {
				return await handleTestCsvRequest(request, env, corsHeaders);
			}

			// 404 處理
			return new Response('Not Found', { 
				status: 404,
				headers: {
					...corsHeaders,
				}
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
};

/**
 * 處理 sensemake API 請求
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
			// 處理 JSON 文件
			comments = await parseJSONFile(file);
		} else if (contentType === 'text/csv' || fileName.endsWith('.csv')) {
			// 處理 CSV 文件
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

		console.log(`Processing ${comments.length} comments with model: ${openRouterModel}`);
		if (additionalContext) {
			console.log(`Additional context: ${additionalContext}`);
		}
		console.log(`Output language: ${outputLang}`);

		// 創建 OpenRouter 模型實例
		const model = new (OpenRouterModel as any)(openRouterApiKey, openRouterModel, env.OPENROUTER_BASE_URL);
		
		// 創建 Sensemaker 實例
		const sensemaker = new Sensemaker({
			defaultModel: model
		});

		// 學習主題
		console.log('Learning topics...');
		try {
			// 添加數據驗證
			console.log('Input comments count:', comments.length);
			console.log('Sample comment:', comments[0]);
			
			// 驗證輸入數據
			if (!Array.isArray(comments) || comments.length === 0) {
				throw new Error('Invalid input: comments must be a non-empty array');
			}
			
			// 檢查每個 comment 的結構
			comments.forEach((comment, index) => {
				if (!comment || typeof comment !== 'object') {
					throw new Error(`Invalid comment at index ${index}: must be an object`);
				}
				if (!comment.id || !comment.text) {
					throw new Error(`Invalid comment at index ${index}: missing id or text`);
				}
			});
			
			const topics = await sensemaker.learnTopics(comments, true, undefined, additionalContext || undefined, 2, outputLang as any);
			console.log('Topics learned:', topics);
			
			// 分類評論
			console.log('Categorizing comments...');
			const categorizedComments = await sensemaker.categorizeComments(comments, true, topics, additionalContext || undefined, 2, outputLang as any);
			console.log('Comments categorized, count:', categorizedComments.length);
			console.log('Sample categorized comment:', categorizedComments[0]);
			
					// 驗證分類後的評論
		if (!Array.isArray(categorizedComments)) {
			console.error('Categorized comments is not an array:', typeof categorizedComments, categorizedComments);
			throw new Error('Categorization failed: expected array of comments');
		}
		
		// 檢查分類後的評論結構
		categorizedComments.forEach((comment, index) => {
			if (!comment || typeof comment !== 'object') {
				console.error(`Invalid categorized comment at index ${index}:`, comment);
				throw new Error(`Invalid categorized comment at index ${index}: must be an object`);
			}
			if (!comment.id || !comment.text) {
				console.error(`Invalid categorized comment at index ${index}:`, comment);
				throw new Error(`Invalid categorized comment at index ${index}: missing id or text`);
			}
			if (!Array.isArray(comment.topics)) {
				console.error(`Invalid categorized comment at index ${index}: topics is not an array:`, comment.topics);
				throw new Error(`Invalid categorized comment at index ${index}: topics must be an array`);
			}
		});
			
			// 生成摘要
			console.log('Generating summary...');
			const summary = await sensemaker.summarize(
				categorizedComments, 
				SummarizationType.AGGREGATE_VOTE, 
				topics, 
				additionalContext || undefined, 
				outputLang as any
			);

			// 移除 TopicSummary 部分，只保留核心摘要內容
			const filteredSummary = summary.withoutContents((sc) => sc.type === "TopicSummary");

			// 獲取 markdown 格式的摘要
			const markdownContent = filteredSummary.getText("MARKDOWN");

			// 返回結果
			return new Response(
				JSON.stringify({
					success: true,
					model: openRouterModel,
					commentsProcessed: comments.length,
					additionalContext: additionalContext || null,
					outputLanguage: outputLang,
					summary: markdownContent
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
			console.error('Error in AI processing:', error);
			
			// 如果是空回應錯誤，提供更友好的錯誤信息
			if (error instanceof Error && error.message.includes('Empty response')) {
				return new Response(
					JSON.stringify({ 
						error: 'AI Model Error', 
						message: 'AI 模型返回了空回應，這可能是由於：\n1. 模型暫時不可用\n2. 請求內容過於複雜\n3. API 配額已用完\n\n建議：\n- 稍後重試\n- 檢查 API 金鑰是否有效\n- 嘗試使用不同的模型',
						suggestion: 'retry_later'
					}), 
					{ 
						status: 503, 
						headers: { 
							'Content-Type': 'application/json',
							...corsHeaders,
						} 
					}
				);
			}
			
			// 重新拋出其他錯誤
			throw error;
		}

	} catch (error) {
		console.error('Error in sensemake processing:', error);
		return new Response(
			JSON.stringify({ 
				error: 'Processing Error', 
				message: error instanceof Error ? error.message : 'Unknown processing error' 
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
 * 解析 JSON 文件
 */
async function parseJSONFile(file: File): Promise<Comment[]> {
	const jsonText = await file.text();
	const jsonData = JSON.parse(jsonText);
	
	if (Array.isArray(jsonData)) {
		return jsonData.map((item, index) => ({
			id: item.id || `comment-${index}`,
			text: item.text || item.comment_text || '',
			voteInfo: item.voteInfo || item.votes || undefined,
			topics: item.topics || undefined
		}));
	} else if (jsonData.comments && Array.isArray(jsonData.comments)) {
		return jsonData.comments.map((item: any, index: number) => ({
			id: item.id || `comment-${index}`,
			text: item.text || item.comment_text || '',
			voteInfo: item.voteInfo || item.votes || undefined,
			topics: item.topics || undefined
		}));
	} else {
		throw new Error('Invalid JSON format: expected array of comments or object with comments array');
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
						if (comment.voteInfo.constructor?.name === 'VoteTally') {
							// 簡單投票格式
							const voteData = comment.voteInfo as any;
							return {
								agreeCount: voteData.agreeCount,
								disagreeCount: voteData.disagreeCount,
								passCount: voteData.passCount,
								totalCount: voteData.getTotalCount ? voteData.getTotalCount(true) : 'N/A',
								hasGetTotalCount: !!voteData.getTotalCount
							};
						} else {
							// 群組投票格式
							return Object.fromEntries(
								Object.entries(comment.voteInfo).map(([key, voteData]) => [
									key,
									{
										agreeCount: voteData.agreeCount,
										disagreeCount: voteData.disagreeCount,
										passCount: voteData.passCount,
										totalCount: voteData.getTotalCount ? voteData.getTotalCount(true) : 'N/A',
										hasGetTotalCount: !!voteData.getTotalCount
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
