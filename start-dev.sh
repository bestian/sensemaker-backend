#!/bin/bash

# Sensemaker Backend 開發環境啟動腳本

echo "🚀 啟動 Sensemaker Backend 開發環境..."

# 檢查是否安裝了依賴
if [ ! -d "node_modules" ]; then
    echo "📦 安裝依賴..."
    npm install
fi

# 檢查環境變數配置
if [ ! -f ".dev.vars" ]; then
    echo "⚠️  未找到 .dev.vars 文件"
    echo "📝 請複製 .dev.vars.example 為 .dev.vars 並配置您的 OpenRouter API 金鑰"
    echo "   cp .dev.vars.example .dev.vars"
    echo "   然後編輯 .dev.vars 文件填入您的 API 金鑰"
    echo "   注意：.dev.vars 文件已經在 .gitignore 中，不會被提交到版本控制"
    echo ""
    echo "💡 提示："
    echo "   - .dev.vars 用於存放敏感信息（如 API 金鑰）"
    echo "   - wrangler.jsonc 用於存放非敏感配置（如模型名稱）"
    echo ""
fi

# 啟動開發服務器
echo "🌐 啟動開發服務器..."
echo "📍 服務將在 http://localhost:8787 上運行"
echo "🔗 健康檢查: http://localhost:8787/api/test"
echo "📖 API 文檔: 查看 README.md"
echo ""
echo "按 Ctrl+C 停止服務器"
echo ""

npm run dev
