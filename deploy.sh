#!/bin/bash

echo "🚀 部署 Sensemaker Backend 到 Cloudflare Workers..."

# 檢查是否安裝了 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ 錯誤: 未找到 wrangler 命令"
    echo "請先安裝 wrangler: npm install -g wrangler"
    exit 1
fi

# 檢查是否已登入
if ! wrangler whoami &> /dev/null; then
    echo "🔐 請先登入 Cloudflare:"
    wrangler login
fi

# 生成類型定義
echo "📝 生成類型定義..."
wrangler types

# 部署到 Cloudflare Workers
echo "🌐 部署到 Cloudflare Workers..."
wrangler deploy

echo "✅ 部署完成！"
echo "📖 使用說明:"
echo "1. 前端可以通過 POST /api/sensemake 提交任務"
echo "2. 使用 GET /api/sensemake/result/:taskId 輪詢結果"
echo "3. 結果會存儲在 R2 存儲桶中"
echo "4. 建議前端每 20 秒輪詢一次"
