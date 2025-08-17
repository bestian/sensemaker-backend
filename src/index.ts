/// <reference path="../worker-configuration.d.ts" />
import type { ExportedHandler, ExecutionContext } from '@cloudflare/workers-types';
import { Sensemaker, OpenRouterModel } from 'sensemaking-tools';

/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Import and log sensemaker
		console.log('Sensemaker imported successfully:', Sensemaker);
		console.log('OpenRouterModel imported successfully:', OpenRouterModel);
		
		// Log the entire sensemaking-tools package
		console.log('Full sensemaking-tools package:', { Sensemaker, OpenRouterModel });
		
		return new Response('Hello, World! Sensemaker imported successfully!');
	},
};
