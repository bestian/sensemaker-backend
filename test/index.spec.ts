import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import commentsTestCsv from '../files/comments_test.csv?raw';
import worker from '../src';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const INITIAL_WAIT_MS = 30_000;
const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_ATTEMPTS = 20;
const TEST_BASE_URL = process.env.SENSEMAKER_TEST_BASE_URL || 'http://localhost:8787';
const TEST_MODEL = 'openai/gpt-oss-120b';

describe('Sensemaker Backend API', () => {
	describe('health check endpoint', () => {
		it('/api/test responds with health message (unit style)', async () => {
			const request = new Request('http://example.com/api/test');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env as any, ctx);
			await waitOnExecutionContext(ctx);
			const responseText = await response.text();
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('application/json');
			
			const responseData = JSON.parse(responseText);
			expect(responseData.status).toBe('ok');
			expect(responseData.message).toBe('Sensemaker Backend with Queue is running');
			expect(responseData.environment).toBe('development');
			expect(responseData.timestamp).toBeDefined();
		});

		it('/api/test responds with health message (integration style)', async () => {
			const request = new Request('http://example.com/api/test');
			const response = await SELF.fetch(request);
			const responseText = await response.text();
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('application/json');
			
			const responseData = JSON.parse(responseText);
			expect(responseData.status).toBe('ok');
			expect(responseData.message).toBe('Sensemaker Backend with Queue is running');
			expect(responseData.environment).toBe('development');
			expect(responseData.timestamp).toBeDefined();
		});
	});

	describe('CORS handling', () => {
		it('handles OPTIONS preflight request', async () => {
			const request = new Request('http://example.com/api/test', {
				method: 'OPTIONS',
				headers: {
					'Origin': 'http://localhost:3000'
				}
			});
			const response = await SELF.fetch(request);
			expect(response.status).toBe(200);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
		});

		it('includes CORS headers in response', async () => {
			const request = new Request('http://example.com/api/test', {
				headers: {
					'Origin': 'http://localhost:3000'
				}
			});
			const response = await SELF.fetch(request);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
			expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
		});
	});

	describe('error handling', () => {
		it('returns 404 for unknown routes', async () => {
			const request = new Request('http://example.com/unknown');
			const response = await SELF.fetch(request);
			expect(response.status).toBe(404);
		});
	});

	describe('queue integration with CSV file', () => {
		const openRouterApiKey = process.env.OPENROUTER_API_KEY || ((env as any).OPENROUTER_API_KEY as string | undefined);
		const shouldRunQueueE2E = process.env.RUN_QUEUE_E2E !== 'false';
		const hasUsableApiKey = !!openRouterApiKey && openRouterApiKey !== 'ci-placeholder';
		const queueTest = shouldRunQueueE2E && hasUsableApiKey ? it : it.skip;

		queueTest(
			'uploads comments_test.csv, then polls result until markdown is produced',
			async () => {
				const csvFile = new File([commentsTestCsv], 'comments_test.csv', { type: 'text/csv' });

				const submitFormData = new FormData();
				submitFormData.append('file', csvFile);

				const submitUrl = new URL('/api/sensemake', TEST_BASE_URL);
				submitUrl.searchParams.set('OPENROUTER_API_KEY', openRouterApiKey as string);
				submitUrl.searchParams.set('OPENROUTER_MODEL', TEST_MODEL);

				const submitResponse = await fetch(submitUrl, {
					method: 'POST',
					body: submitFormData,
				});
				const submitPayload = await submitResponse.json() as {
					success?: boolean;
					taskId?: string;
					pollingUrl?: string;
					status?: string;
				};

				expect(submitResponse.status).toBe(202);
				expect(submitPayload.success).toBe(true);
				expect(submitPayload.status).toBe('queued');
				expect(submitPayload.taskId).toBeDefined();
				expect(typeof submitPayload.pollingUrl).toBe('string');

				const taskId = submitPayload.taskId as string;
				const pollingPath = submitPayload.pollingUrl as string;
				let completed = false;
				let lastPayload: any = null;
				let lastStatusCode = 0;

				await sleep(INITIAL_WAIT_MS);

				for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
					const pollUrl = new URL(pollingPath, TEST_BASE_URL);
					const pollResponse = await fetch(pollUrl);
					lastStatusCode = pollResponse.status;
					lastPayload = await pollResponse.json();

					if (pollResponse.status === 200 && lastPayload?.status === 'completed') {
						expect(typeof lastPayload.summary).toBe('string');
						expect(lastPayload.summary.trim().length).toBeGreaterThan(0);
						completed = true;
						break;
					}

					if (pollResponse.status === 500 && lastPayload?.status === 'failed') {
						throw new Error(`Queue task failed: ${lastPayload.error ?? 'unknown error'}`);
					}

					// still processing states: 404/not_found, queued, processing
					if (
						(pollResponse.status === 404 && lastPayload?.status === 'not_found') ||
						lastPayload?.status === 'queued' ||
						lastPayload?.status === 'processing'
					) {
						if (attempt < MAX_POLL_ATTEMPTS) {
							await sleep(POLL_INTERVAL_MS);
						}
						continue;
					}

					throw new Error(
						`Unexpected polling response: status=${pollResponse.status}, payload=${JSON.stringify(lastPayload)}`
					);
				}

				expect(completed, `Task ${taskId} did not complete. Last status=${lastStatusCode}, payload=${JSON.stringify(lastPayload)}`).toBe(true);
			},
			11 * 60_000
		);
	});
});
