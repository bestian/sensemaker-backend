# Sensemaker Backend with Cloudflare Queues

## 概述

這個版本使用 Cloudflare Queues 來解決背景任務被前端輪詢中斷的問題。

## 架構改進

### 之前：使用 `ctx.waitUntil()`
- ❌ 容易被前端輪詢中斷
- ❌ 任務執行不穩定
- ❌ 無法處理長時間任務

### 現在：使用 Cloudflare Queues
- ✅ 完全解耦，不受前端連線影響
- ✅ 自動重試機制
- ✅ 支援長時間任務（>30分鐘）
- ✅ 更好的錯誤處理

## 部署步驟

### 1. 更新 wrangler.jsonc
已添加 Queues 配置：
```json
"queues": {
  "producers": [
    {
      "binding": "SENSEMAKER_QUEUE",
      "name": "sensemaker-tasks"
    }
  ],
  "consumers": [
    {
      "queue": "sensemaker-tasks",
      "max_batch_size": 1,
      "max_batch_timeout": 30,
      "max_retries": 3,
      "dead_letter_queue": "sensemaker-failed-tasks"
    }
  ]
}
```

### 2. 部署 Queue 版本
```bash
chmod +x deploy-queue.sh
./deploy-queue.sh
```

### 3. 檢查部署狀態
在 Cloudflare Dashboard 中檢查：
- Workers > sensemaker-backend
- Queues > sensemaker-tasks

## 工作流程

1. **前端提交任務**
   - POST `/api/sensemake`
   - 任務被加入 Queue
   - 立即返回 `taskId`

2. **Queue Consumer 處理**
   - 從 Queue 取出任務
   - 執行 Sensemaker 分析
   - 更新任務狀態到 R2
   - 存儲結果到 R2

3. **前端輪詢結果**
   - 延遲5分鐘開始輪詢
   - 每1分鐘檢查一次
   - GET `/api/sensemake/result/:taskId`

## 前端改進

- 延遲5分鐘開始輪詢
- 輪詢間隔改為1分鐘
- 更好的狀態提示

## 監控和調試

### Queue 狀態
```bash
# 檢查 Queue 狀態
wrangler queues list

# 查看特定 Queue 的統計
wrangler queues tail sensemaker-tasks
```

### 日誌分析
- Queue Consumer 日誌會顯示任務處理狀態
- 任務狀態會存儲在 R2 中
- 支援重試和錯誤處理

## 故障排除

### 常見問題

1. **Queue 不工作**
   - 檢查 wrangler.jsonc 配置
   - 確認 Queue 已創建
   - 檢查 Worker 權限

2. **任務卡住**
   - 檢查 dead letter queue
   - 查看 Worker 日誌
   - 確認 R2 權限

3. **重試過多**
   - 調整 max_retries 設置
   - 檢查錯誤日誌
   - 優化錯誤處理邏輯

## 性能優化

- Queue 批次處理：`max_batch_size: 1`
- 超時設置：`max_batch_timeout: 30`
- 自動重試：`max_retries: 3`
- 死信隊列：處理失敗的任務

## 下一步

- 添加任務優先級
- 實現任務取消功能
- 添加進度追蹤
- 支援並行處理
