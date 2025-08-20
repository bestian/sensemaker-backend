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
