/// <reference path="../worker-configuration.d.ts" />
import type { ExportedHandler, ExecutionContext } from '@cloudflare/workers-types';
import { Sensemaker, OpenRouterModel, SummarizationType, VoteTally } from 'sensemaking-tools';
import type { Comment, Topic } from 'sensemaking-tools';
import { parseCSVFile, parseTopicsString, getTopicsFromComments } from './utils/sensemake_openrouter_utils';

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
				return new Response('Sensemaker Backend is running! 🚀', {
					headers: { 
						'Content-Type': 'text/plain; charset=utf-8',
						...corsHeaders,
					}
				});
			}

			// Sensemake API 端點
			if (path === '/api/sensemake' && request.method === 'POST') {
				return await handleSensemakeRequest(request, url, env, corsHeaders);
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
		const model = new OpenRouterModel(openRouterApiKey, openRouterModel);
		
		// 創建 Sensemaker 實例
		const sensemaker = new Sensemaker({
			defaultModel: model
		});

		// 學習主題
		console.log('Learning topics...');
		try {
			const topics = await sensemaker.learnTopics(comments, true, undefined, additionalContext || undefined, 2, outputLang as any);
			
			// 分類評論
			console.log('Categorizing comments...');
			const categorizedComments = await sensemaker.categorizeComments(comments, true, topics, additionalContext || undefined, 2, outputLang as any);
			
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




