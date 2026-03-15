# CI Bug Fix TODO

## Bug 1: `queue-e2e-live` — Missing `CLOUDFLARE_API_TOKEN` [Critical]

**File:** `.github/workflows/ci.yml`

`wrangler dev` fails in CI with auth error because no user is logged in and `CLOUDFLARE_API_TOKEN` is not provided.

**Fix:** Add to the `queue-e2e-live` job's `env` section:

```yaml
env:
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}  # add this
```

Also add `CLOUDFLARE_API_TOKEN` to the GitHub repo secrets.

---

## Bug 2: `queue-e2e-live` — Queue consumer won't fire in local `wrangler dev` [Critical]

**File:** `.github/workflows/ci.yml`

Cloudflare Queues don't process messages automatically in local `wrangler dev`. The consumer is never triggered, so the E2E test always times out (~10.5 min of polling then fails).

**Options:**
- Use `wrangler dev --remote` (requires auth + a deployed worker)
- Or skip the local dev server entirely and point `SENSEMAKER_TEST_BASE_URL` at the deployed worker URL

**Recommended fix:** Remove the local dev server setup and test against the deployed worker:

```yaml
# Remove these steps:
# - name: Start worker dev server
# - name: Wait for API ready

# Change env to:
env:
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
    RUN_QUEUE_E2E: 'true'
    SENSEMAKER_TEST_BASE_URL: ${{ secrets.SENSEMAKER_DEPLOYED_URL }}
```

---

## Bug 3: `unit-and-typecheck` — Redundant regex test filter [Minor]

**File:** `.github/workflows/ci.yml`, line 30

```yaml
run: npm test -- --run -t "^(?!.*queue integration with CSV file).*$"
```

The queue tests are already `it.skip`-ed when `RUN_QUEUE_E2E=false`, so the regex is unnecessary. It could accidentally filter unintended tests if vitest concatenates describe names differently.

**Fix:**

```yaml
run: npm test -- --run
```

---

## Bug 4: `queue-e2e-live` — `wrangler dev` may hang on telemetry prompt [Medium]

**File:** `.github/workflows/ci.yml`

Without a TTY, `wrangler dev` may hang waiting for interactive prompts (telemetry opt-in, etc.).

**Fix:** Set env var when starting the dev server:

```yaml
- name: Start worker dev server
  run: npm run dev > dev-server.log 2>&1 &
  env:
      WRANGLER_SEND_METRICS: 'false'
```

---

## Priority Order

1. Bug 2 (queue consumer) — architectural, need to decide on approach
2. Bug 1 (CLOUDFLARE_API_TOKEN) — simple secret addition
3. Bug 4 (telemetry hang) — easy env var fix
4. Bug 3 (regex filter) — trivial cleanup
