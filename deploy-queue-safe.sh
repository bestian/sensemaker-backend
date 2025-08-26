#!/bin/bash

echo "🚀 安全部署 Sensemaker Backend with Queue 版本..."

# 檢查 wrangler 是否安裝
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler CLI 未安裝，請先安裝："
    echo "npm install -g wrangler"
    exit 1
fi

# 檢查 Queue 是否存在
echo "📋 檢查 Queue 狀態..."
QUEUE_EXISTS=$(wrangler queues list | grep "sensemaker-tasks" | wc -l)

if [ $QUEUE_EXISTS -eq 0 ]; then
    echo "❌ Queue 'sensemaker-tasks' 不存在！"
    echo "請先運行 ./setup-queues.sh 創建 Queues"
    exit 1
fi

echo "✅ Queue 'sensemaker-tasks' 已存在"

# 檢查 dead letter queue
echo "📋 檢查 dead letter queue..."
DLQ_EXISTS=$(wrangler queues list | grep "sensemaker-failed-tasks" | wc -l)

if [ $DLQ_EXISTS -eq 0 ]; then
    echo "⚠️  Dead letter queue 'sensemaker-failed-tasks' 不存在，正在創建..."
    wrangler queues create sensemaker-failed-tasks
fi

# 備份原始文件
echo "📋 備份原始文件..."
cp src/index.ts src/index-backup.ts

# 替換為 Queue 版本
echo "🔄 替換為 Queue 版本..."
cp src/index-queue.ts src/index.ts

# 使用專門的配置文件部署
echo "☁️ 使用 wrangler-queues.jsonc 部署到 Cloudflare..."
wrangler deploy --config wrangler-queues.jsonc

# 恢復原始文件
echo "📋 恢復原始文件..."
cp src/index-backup.ts src/index.ts

echo "✅ 部署完成！"
echo "📝 注意：Queue 版本已部署，原始版本已恢復"
echo "🔍 檢查 Cloudflare Dashboard 中的 Queues 狀態"
echo "📊 使用 'wrangler queues list' 檢查 Queue 狀態"
