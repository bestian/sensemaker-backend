# Sensemaker Backend - Claude Code Guide

## Project Overview

Cloudflare Workers backend integrating `sensemaking-tools` for async comment analysis via LLM.

## Tech Stack

- **Runtime**: Cloudflare Workers (TypeScript)
- **Build/Deploy**: Wrangler (`wrangler.jsonc`)
- **Testing**: Vitest with `@cloudflare/vitest-pool-workers`
- **Async Queue**: Cloudflare Queue (`sensemaker-tasks`)
- **Storage**: Cloudflare R2 (`SENSEMAKER_RESULTS` binding)
- **LLM**: OpenRouter API via `sensemaking-tools` library

## Commands

```bash
npm run dev       # Local dev server at http://localhost:8787
npm test          # Run Vitest tests
npm run deploy    # Deploy via wrangler (or use ./deploy-queue-safe.sh)
npm run cf-typegen  # Regenerate Cloudflare types
```

## Project Structure

```
src/
  index.ts                    # Main entry: HTTP handler + Queue consumer
  utils/
    sensemake_openrouter_utils.ts
    parseJSON.ts
    getFormDataString.ts
public/                       # Static assets (served at /)
test/                         # Vitest tests
wrangler.jsonc                # Cloudflare config (queues, R2, vars)
```

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/test` | Health check |
| POST | `/api/sensemake` | Submit comment analysis task (queued) |
| GET | `/api/sensemake/result/:taskId` | Poll task result from R2 |
| DELETE | `/api/sensemake/delete/:taskId` | Delete task result |
| POST | `/api/test-llm` | Test LLM connectivity |
| POST | `/api/test-csv` | Test CSV parsing |
| POST | `/api/test-json` | Test JSON parsing |
| POST | `/api/test-r2` | Test R2 read/write |

## Environment Variables

Set in `.dev.vars` for local dev (gitignored):
```
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=openai/gpt-oss-20b:free
IS_DEVELOPMENT=true
```

Priority: query params > env vars > defaults in `wrangler.jsonc`

## Env Interface (`src/index.ts`)

```typescript
interface Env {
  OPENROUTER_API_KEY: string;
  OPENROUTER_BASE_URL: string;
  OPENROUTER_MODEL: string;
  IS_DEVELOPMENT?: string;
  SENSEMAKER_RESULTS: R2Bucket;
  SENSEMAKER_QUEUE: Queue;
}
```

## Queue Processing

- Tasks submitted to `sensemaker-tasks` queue
- Consumer processes 1 task at a time (`max_batch_size: 1`)
- Max 3 retries; failures go to `sensemaker-failed-tasks` DLQ
- Results stored in R2 as JSON, keyed by `taskId`

## Deployment

Use the safe deployment script that handles queue setup:
```bash
sh ./deploy-queue-safe.sh
```
