#!/bin/bash

echo "🧪 測試 files/comments.csv 解析"
echo "=============================="

# 測試 CSV 文件
CSV_FILE="files/comments.csv"

if [ ! -f "$CSV_FILE" ]; then
    echo "❌ 找不到測試文件: $CSV_FILE"
    exit 1
fi

echo "📁 使用測試文件: $CSV_FILE"
echo "📊 文件內容預覽:"
head -5 "$CSV_FILE"
echo ""

echo "🚀 發送請求到 /api/test-csv..."
echo ""

# 使用 curl 發送 POST 請求
curl -X POST \
  -F "file=@$CSV_FILE" \
  -H "Content-Type: multipart/form-data" \
  "http://localhost:8787/api/test-csv" \
  -s | jq '.' 2>/dev/null || curl -X POST \
  -F "file=@$CSV_FILE" \
  -H "Content-Type: multipart/form-data" \
  "http://localhost:8787/api/test-csv" \
  -s

echo ""
echo "✅ 測試完成！"
