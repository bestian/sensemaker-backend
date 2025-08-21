import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

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
			expect(responseData.message).toBe('Sensemaker Backend is running');
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
			expect(responseData.message).toBe('Sensemaker Backend is running');
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
			expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
		});
	});

	describe('error handling', () => {
		it('returns 404 for unknown routes', async () => {
			const request = new Request('http://example.com/unknown');
			const response = await SELF.fetch(request);
			expect(response.status).toBe(404);
		});
	});
});
