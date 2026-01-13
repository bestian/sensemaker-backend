---
name: preflight-api-key-check
overview: 在 /api/sensemake 入口新增 OpenRouter API Key 即時驗證，失敗時立即回傳 Invalid API Key 並不入 queue。
todos:
  - id: read-current-flow
    content: 複查 handleSensemakeRequest 目前流程與 queue 建立
    status: pending
  - id: add-preflight-call
    content: 在入 queue 前用 OpenRouter 發 Hello World 驗證 key
    status: pending
    dependencies:
      - read-current-flow
  - id: return-401-invalid
    content: 驗證失敗時回傳 401 Invalid API Key 並停流程
    status: pending
    dependencies:
      - add-preflight-call
  - id: verify-success-path
    content: 確認通過預檢後流程不變且訊息清晰
    status: pending
    dependencies:
      - return-401-invalid
---

# 新增 API Key 預檢並回傳 Invalid API Key

- **預檢時機**：在 [`src/index.ts`](/Users/bestian/Documents/GitHub/sensemaker-backend/src/index.ts) 的 `handleSensemakeRequest` 中，取得 `openRouterApiKey` 後且在解析/入 queue 之前，對 OpenRouter 發送一次簡單 Hello World prompt。
- **測試內容**：固定使用短 prompt（例如 `Please reply with: Hello World`），透過現有的 `OpenRouterModel`/`generateText`（或等效方法）執行。
- **失敗處理**：若呼叫失敗（認證錯誤/非 2xx），直接回傳 HTTP 401，錯誤訊息為 `Invalid API Key`，並附詳細原因；不建立任務、不寫入 queue。
- **成功流程**：預檢通過後才繼續既有的檔案解析、任務建立與 queue 流程；不影響其他來源網域的邏輯。
- **錯誤訊號統一**：確保前端拿到明確的 `Invalid API Key` 訊息，不再出現泛用的「Topic identification failed」重試錯誤。