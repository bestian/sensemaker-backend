#!/bin/bash

echo "🧪 Testing Sensemaker Backend LLM Integration..."
echo "================================================"

# 檢查服務器是否運行
echo "1. Checking if server is running..."
if curl -s http://localhost:8787/api/test > /dev/null; then
    echo "✅ Server is running on http://localhost:8787"
else
    echo "❌ Server is not running. Please start with: npm run dev"
    exit 1
fi

# 測試健康檢查
echo ""
echo "2. Testing health check endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:8787/api/test)
echo "Health check response: $HEALTH_RESPONSE"

# 測試 LLM 集成
echo ""
echo "3. Testing LLM integration endpoint..."
echo "This may take a few seconds..."
LLM_RESPONSE=$(curl -s -X POST http://localhost:8787/api/test-llm)

# 檢查結果
echo ""
echo "4. Analyzing results..."
if echo "$LLM_RESPONSE" | grep -q '"success":\s*true'; then
    echo "✅ LLM test PASSED!"
    echo ""
    echo "📊 Test Summary:"
    echo "$LLM_RESPONSE" | jq '.' 2>/dev/null || echo "$LLM_RESPONSE"
else
    echo "❌ LLM test FAILED!"
    echo ""
    echo "🔍 Error Details:"
    echo "$LLM_RESPONSE" | jq '.' 2>/dev/null || echo "$LLM_RESPONSE"
    echo ""
    echo "💡 Troubleshooting tips:"
    echo "- Check your .dev.vars file for correct API keys"
    echo "- Verify OpenRouter API is accessible"
    echo "- Check the server console for detailed error logs"
fi

echo ""
echo "🎯 Next steps:"
echo "- Check the server console for detailed debug information"
echo "- Review the test.md file for troubleshooting tips"
echo "- Test with different prompts or models if needed"
