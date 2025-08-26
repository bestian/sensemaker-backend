#!/bin/bash

echo "🚀 設置 Cloudflare Queues for Sensemaker..."

# 檢查 wrangler 是否安裝
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler CLI 未安裝，請先安裝："
    echo "npm install -g wrangler"
    exit 1
fi

echo "📋 檢查現有的 Queues..."
wrangler queues list

echo ""
echo "🔄 創建 sensemaker-tasks Queue..."
wrangler queues create sensemaker-tasks

echo ""
echo "🔄 創建 sensemaker-failed-tasks Queue (dead letter queue)..."
wrangler queues create sensemaker-failed-tasks

echo ""
echo "✅ 檢查創建結果..."
wrangler queues list

echo ""
echo "🎯 下一步："
echo "1. 確認 Queues 已創建成功"
echo "2. 運行 ./deploy-queue-safe.sh 部署 Queue 版本"
echo "3. 在 Cloudflare Dashboard 中檢查 Queues 狀態"
