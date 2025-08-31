#!/bin/bash

# CSV 解析功能測試腳本
# 這個腳本用於測試新的 CSV 解析功能

echo "=== CSV 解析功能測試 ==="
echo ""

# 檢查檔案是否存在
echo "1. 檢查測試檔案..."
if [ -f "files/comments.csv" ]; then
    echo "✓ files/comments.csv 存在"
else
    echo "✗ files/comments.csv 不存在"
    exit 1
fi

if [ -f "files/polis_test.csv" ]; then
    echo "✓ files/polis_test.csv 存在"
else
    echo "✗ files/polis_test.csv 不存在"
    exit 1
fi

echo ""

# 檢查伺服器是否運行
echo "2. 檢查伺服器狀態..."
if curl -s http://localhost:8787/api/test > /dev/null; then
    echo "✓ 本地伺服器正在運行"
else
    echo "✗ 本地伺服器未運行，請先執行 'npm run dev'"
    exit 1
fi

echo ""

# 測試完整格式 CSV
echo "3. 測試完整格式 CSV (files/comments.csv)..."
response=$(curl -s -X POST http://localhost:8787/api/test-csv \
  -F "file=@files/comments.csv")

if echo "$response" | jq -e '.success' > /dev/null; then
    echo "✓ 完整格式 CSV 解析成功"
    comments_count=$(echo "$response" | jq '.commentsCount')
    echo "  解析評論數量: $comments_count"
else
    echo "✗ 完整格式 CSV 解析失敗"
    echo "$response" | jq '.error, .message'
fi

echo ""

# 測試 pol.is 格式 CSV
echo "4. 測試 pol.is 格式 CSV (files/polis_test.csv)..."
response=$(curl -s -X POST http://localhost:8787/api/test-csv \
  -F "file=@files/polis_test.csv")

# 檢查回應是否為有效的 JSON
if echo "$response" | jq -e '.' > /dev/null 2>&1; then
    if echo "$response" | jq -e '.success' > /dev/null; then
        echo "✓ pol.is 格式 CSV 解析成功"
        comments_count=$(echo "$response" | jq '.commentsCount')
        echo "  解析評論數量: $comments_count"
        
        # 檢查轉換結果
        first_comment=$(echo "$response" | jq '.comments[0]')
        has_comment_text=$(echo "$first_comment" | jq -e '.text' > /dev/null && echo "true" || echo "false")
        has_vote_info=$(echo "$first_comment" | jq -e '.voteInfo' > /dev/null && echo "true" || echo "false")
        
        echo "  轉換檢查:"
        echo "    - comment_text 欄位: $has_comment_text"
        echo "    - voteInfo 物件: $has_vote_info"
        
        if [ "$has_comment_text" = "true" ] && [ "$has_vote_info" = "true" ]; then
            echo "  ✓ pol.is 格式轉換成功"
        else
            echo "  ✗ pol.is 格式轉換可能有問題"
        fi
    else
        echo "✗ pol.is 格式 CSV 解析失敗"
        echo "$response" | jq '.error, .message' 2>/dev/null || echo "無法解析錯誤訊息"
    fi
else
    echo "✗ pol.is 格式 CSV 解析失敗 - 無效的 JSON 回應"
    echo "原始回應:"
    echo "$response" | head -c 500
    echo "..."
fi

echo ""

echo "=== 測試完成 ==="
echo ""
echo "如果所有測試都通過，表示新的 CSV 解析功能正常工作。"
echo "請檢查伺服器日誌以獲取更詳細的轉換過程信息。"
