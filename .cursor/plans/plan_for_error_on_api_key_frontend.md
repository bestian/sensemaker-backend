---
name: preflight-api-key-check-updated
overview: 在後端新增 OpenRouter API Key 預檢並於前端顯示 401 錯誤訊息。
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
  - id: frontend-401-ui
    content: 前端攔截 401 並在表單/結果區塊顯示 Invalid API Key
    status: pending
  - id: tests-invalid-valid
    content: 用錯/對 key 驗證 401 顯示與正常流程
    status: pending
    dependencies:
      - return-401-invalid
      - frontend-401-ui
---

# 後端預檢 + 前端 401 顯示

- **API Key 預檢**：在 [`src/index.ts`](/Users/bestian/Documents/GitHub/sensemaker-backend/src/index.ts) 的 `handleSensemakeRequest` 中，取得 `openRouterApiKey` 後即發送一次固定 Hello World prompt（`Please reply with: Hello World`）到 OpenRouter；若失敗（含 401/403），回傳 401，訊息為 `Invalid API Key`，不入 queue。
- **成功流程**：預檢通過後保持既有檔案解析、任務建立與 queue 流程不變。
- **前端處理**：在 [`sensemaker-frontend`](file:///Users/bestian/Documents/GitHub/sensemaker-frontend) 的 API 呼叫與結果呈現處，攔截 401，於表單/結果區塊顯示錯誤訊息 "Invalid API Key"，並停止後續輪詢。
- **測試**：用錯誤 key 驗證 401 與錯誤訊息顯示；用正確 key 驗證流程仍可排入 queue 並完成。