# Sensemaker Backend LLM 測試指南

這個文檔說明如何啟動和運行 Sensemaker Backend 的簡單 LLM 測試。

## 🚀 快速開始

### 1. 啟動開發服務器

```bash
# 在 sensemaker-backend 目錄下
npm run dev
```

服務器將在 `http://localhost:8787` 啟動。

### 2. 測試端點

#### 健康檢查端點
```bash
curl http://localhost:8787/api/test
```

**預期回應：**
```json
{
  "status": "ok",
  "message": "Sensemaker Backend is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "development"
}
```


#### CSV 上傳測試端點

**測試新的 CSV 解析功能（支援多種格式）：**

```bash
# 遠端測試 - 完整格式 CSV
curl -X POST https://sensemaker-backend.bestian123.workers.dev/api/test-csv \
  -F "file=@files/comments.csv"

# 遠端測試 - pol.is 格式 CSV
curl -X POST https://sensemaker-backend.bestian123.workers.dev/api/test-csv \
  -F "file=@files/polis_test.csv"

# 本地開發環境測試
curl -X POST http://localhost:8787/api/test-csv \
  -F "file=@files/comments.csv"
```

**測試檔案格式：**

1. **完整格式** (`files/comments.csv`):
```csv
comment-id,comment_text,votes,agrees,disagrees,passes,a-votes,a-agree-count,a-disagree-count,a-pass-count,b-votes,b-agree-count,b-disagree-count,b-pass-count
1,"我認為，台灣目前的自學法規是成熟且可靠的。",10,7,1,2,0,0,0,0,0,0,0,0
2,"我認為，台灣的自學審議機制是合理並可以信任的。",9,7,0,2,0,0,0,0,0,0,0,0
```

2. **pol.is 格式** (`files/polis_test.csv`):
```csv
comment-id,agrees,disagrees,comment-body,moderated
1,7,1,"我認為，台灣目前的自學法規是成熟且可靠的。",1
2,7,0,"我認為，台灣的自學審議機制是合理並可以信任的。",1
```

**新功能特點：**

1. **自動格式偵測**：
   - 偵測 `pol.is` 格式：包含 `comment-id`, `agrees`, `disagrees`, `comment-body` 欄位
   - 偵測完整格式：包含 `comment-id`, `comment_text`, `agrees`, `disagrees`, `passes` 欄位
   - 未知格式：嘗試基本解析

2. **pol.is 格式轉換**：
   - 自動將 `comment-body` 重命名為 `comment_text`
   - 根據 `moderated` 欄位計算 `passes` 值
   - 計算 `votes = agrees + disagrees + passes`

3. **群組投票支援**：
   - 支援 `{group}-agree-count`, `{group}-disagree-count`, `{group}-pass-count` 格式
   - 自動偵測群組名稱並創建群組投票物件

**預期回應：**

成功時（HTTP 200）：
```json
{
  "success": true,
  "fileName": "comments.csv",
  "fileSize": 1234,
  "commentsCount": 16,
  "comments": [
    {
      "id": "1",
      "text": "我認為，台灣目前的自學法規是成熟且可靠的。",
      "voteInfo": {
        "agreeCount": 7,
        "disagreeCount": 1,
        "passCount": 2,
        "totalCount": 10,
        "hasGetTotalCount": true
      }
    }
  ],
  "debug": {
    "lastModified": 1234567890,
    "type": "text/csv"
  }
}
```

失敗時（HTTP 400/500）：
```json
{
  "error": "CSV Test Error",
  "message": "具體錯誤訊息"
}
```

**測試步驟：**

1. **準備測試檔案**：
   ```bash
   # 確保測試檔案存在
   ls -la files/comments.csv
   ls -la files/polis_test.csv
   ```

2. **測試完整格式**：
   ```bash
   curl -X POST http://localhost:8787/api/test-csv \
     -F "file=@files/comments.csv" | jq
   ```

3. **測試 pol.is 格式**：
   ```bash
   curl -X POST http://localhost:8787/api/test-csv \
     -F "file=@files/polis_test.csv" | jq
   ```

4. **檢查轉換結果**：
   - 確認 `comment-body` 是否正確轉換為 `comment_text`
   - 確認 `passes` 欄位是否正確計算
   - 確認 `votes` 欄位是否正確計算
   - 確認 `voteInfo` 物件是否包含 `getTotalCount` 方法

**自動化測試腳本：**

我們提供了一個自動化測試腳本來驗證 CSV 解析功能：

```bash
# 執行自動化測試
./test-csv-parsing.sh
```

這個腳本會：
1. 檢查測試檔案是否存在
2. 檢查本地伺服器是否運行
3. 測試完整格式 CSV 解析
4. 測試 pol.is 格式 CSV 解析
5. 驗證轉換結果

**除錯技巧：**

1. **查看伺服器日誌**：
   ```bash
   # 本地開發時查看 console.log 輸出
   npm run dev
   ```

2. **檢查格式偵測**：
   - 日誌中會顯示 "Detected pol.is format" 或 "Detected complete format"
   - 確認格式偵測是否正確

**總結：**

新的 CSV 解析功能提供了以下改進：

1. **模組化設計**：
   - `readCSVFile()` - 負責檔案讀取
   - `detectCSVFormat()` - 負責格式偵測
   - `parseCSVData()` - 負責數據解析

2. **多格式支援**：
   - 自動偵測 pol.is 格式並進行轉換
   - 支援完整格式的直接解析
   - 支援群組投票格式

3. **向後相容**：
   - 保持原有的 API 介面不變
   - 現有的測試端點仍然可用

4. **易於測試**：
   - 提供詳細的測試說明
   - 包含自動化測試腳本
   - 支援遠端和本地測試

**常見問題和解決方案：**

1. **JSON 解析錯誤**：
   - 問題：`jq: parse error: Invalid string: control characters from U+0000 through U+001F must be escaped`
   - 解決方案：測試腳本已更新，包含錯誤處理和 JSON 驗證

2. **欄位重命名問題**：
   - 問題：`comment-body` 重命名為 `comment_text` 後，欄位名稱列表未更新
   - 解決方案：已修復 `convertCSV_new` 函式，確保欄位重命名後正確更新 `fieldnames`

3. **格式偵測問題**：
   - 問題：某些 pol.is 變體格式未被正確偵測
   - 解決方案：已增強 `detectCSVFormat` 函式，支援包含額外欄位的 pol.is 變體

**測試建議：**

1. **開發階段**：使用本地測試和自動化腳本
2. **部署前**：使用遠端測試驗證生產環境
3. **問題排查**：查看伺服器日誌和測試回應
4. **格式驗證**：確認轉換後的數據結構正確
#### JSON 上傳測試端點

**測試 JSON 檔案解析功能：**

```bash
# 測試標準 JSON 格式
curl -X POST https://sensemaker-backend.bestian123.workers.dev/api/test-json \
  -F "file=@test-comments.json"

# 測試 Polis.tw 格式的 JSON
curl -X POST https://sensemaker-backend.bestian123.workers.dev/api/test-json \
  -F "file=@files/polis_report.json"

# 本地開發環境測試
curl -X POST http://localhost:8787/api/test-json \
  -F "file=@files/polis_report.json"
```

**測試檔案格式：**

1. **標準格式** (`test-comments.json`):
```json
[
  {
    "id": "comment-1",
    "text": "這個產品真的很棒，使用起來非常方便！",
    "voteInfo": {
      "agreeCount": 15,
      "disagreeCount": 2,
      "passCount": 1
    }
  }
]
```

2. **Polis.tw 格式** (`files/polis_report.json`):
```json
[
  {
    "txt": "我認為，台灣目前的自學法規是成熟且可靠的。",
    "tid": 1,
    "agree_count": 7,
    "disagree_count": 1,
    "pass_count": 2,
    "count": 10
  }
]
```

**預期回應：**
- 成功：HTTP 200，包含解析後的評論資料
- 失敗：HTTP 400/500，包含錯誤訊息

#### LLM 測試端點
```bash
curl -X POST http://localhost:8787/api/test-llm
```

**預期回應（成功）：**
```json
{
  "success": true,
  "message": "LLM test completed successfully",
  "testComment": {
    "id": "test-1",
    "text": "這是一個測試評論，用來驗證 LLM 是否正常工作。"
  },
  "simpleResponse": "測試成功",
  "structuredResponse": {
    "sentiment": "neutral",
    "confidence": 0.8
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**預期回應（失敗）：**
```json
{
  "success": false,
  "message": "LLM test failed",
  "error": "具體錯誤信息",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🔧 環境變量配置

確保你的 `.dev.vars` 文件包含以下配置：

```bash
# OpenRouter API Configuration
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-oss-20b:free

# Optional: Custom headers for OpenRouter
OPENROUTER_X_TITLE=Sensemaking Tools
```

## 📊 測試內容詳解

### 測試 1：簡單文本生成
- **Prompt**: `請用繁體中文回答：這是一個測試，請回覆"測試成功"`
- **預期**: LLM 應該回覆"測試成功"
- **語言**: 繁體中文 (zh-TW)

### 測試 2：結構化數據生成
- **Prompt**: 分析評論情感傾向，返回 JSON 格式
- **Schema**: 
  ```json
  {
    "sentiment": "positive/negative/neutral",
    "confidence": 0.9
  }
  ```
- **預期**: 結構化的 JSON 回應

## 🐛 故障排除

### 常見問題

#### 1. 環境變量未讀取
```bash
# 檢查 .dev.vars 文件是否存在
ls -la .dev.vars

# 重新啟動服務器
npm run dev
```

#### 2. OpenRouter API 錯誤
- 檢查 API key 是否有效
- 確認模型名稱是否正確
- 檢查網絡連接

#### 3. CORS 錯誤
- 確認請求來源是否在允許列表中
- 檢查 CORS headers 設置

### 調試技巧

#### 查看 Console 輸出
在運行 `npm run dev` 的終端中，你會看到詳細的 debug 信息：

```
=== TESTING LLM INTEGRATION ===
Test comment: { id: 'test-1', text: '這是一個測試評論...' }
Model created with: { apiKey: '***d627', model: 'openai/gpt-oss-20b:free', baseURL: 'https://openrouter.ai/api/v1' }
Testing simple text generation...
=== OPENROUTER LLM CALL DEBUG ===
languagePrefix: 以下問題請一定要全文使用繁體中文回答，不要用其他語言回答！
output_lang: zh-TW
model: openai/gpt-oss-20b:free
original prompt: 請用繁體中文回答：這是一個測試，請回覆"測試成功"
full prompt with language prefix: 以下問題請一定要全文使用繁體中文回答，不要用其他語言回答！請用繁體中文回答：這是一個測試，請回覆"測試成功"
Request options: {...}
=== OPENROUTER RESPONSE DEBUG ===
Response content: 測試成功
=== END DEBUG ===
```

#### 檢查網絡請求
使用瀏覽器開發者工具或 curl 的 verbose 模式：

```bash
curl -v -X POST http://localhost:8787/api/test-llm
```

## 📝 測試腳本

### 自動化測試腳本

創建 `test-llm.sh` 腳本：

```bash
#!/bin/bash

echo "🧪 Testing Sensemaker Backend LLM Integration..."

# 測試健康檢查
echo "1. Testing health check..."
HEALTH_RESPONSE=$(curl -s http://localhost:8787/api/test)
echo "Health check response: $HEALTH_RESPONSE"

# 測試 LLM
echo "2. Testing LLM integration..."
LLM_RESPONSE=$(curl -s -X POST http://localhost:8787/api/test-llm)
echo "LLM test response: $LLM_RESPONSE"

# 檢查結果
if echo "$LLM_RESPONSE" | grep -q '"success":true'; then
    echo "✅ LLM test passed!"
else
    echo "❌ LLM test failed!"
    echo "Error details: $LLM_RESPONSE"
fi
```

使用方法：
```bash
chmod +x test-llm.sh
./test-llm.sh
```

## 🎯 下一步

測試成功後，你可以：

1. **測試完整的 Sensemaker 功能** - 使用 `/api/sensemake` 端點
2. **調整模型參數** - 修改 prompt 或 schema
3. **測試不同的語言** - 嘗試英文或其他語言
4. **性能測試** - 測試響應時間和穩定性

## 📞 需要幫助？

如果遇到問題：

1. 檢查 console 輸出中的錯誤信息
2. 確認環境變量設置
3. 檢查 OpenRouter API 狀態
4. 查看 Sensemaker Backend 的完整日誌

---

**注意**: 這個測試端點僅用於開發和調試，生產環境中應該移除或保護。
