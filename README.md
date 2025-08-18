# Sensemaker Backend

[English](#english) | [中文](#chinese)

---

## 中文

### 項目簡介

Sensemaker Backend 是一個基於 Cloudflare Workers 的後端服務，集成了 sensemaking-tools 庫，提供智能分析和處理功能。

#### API 端點

- **GET /** - 健康檢查端點
- **POST /api/sensemake** - 智能分析評論數據
  - 查詢參數：
    - `OPENROUTER_API_KEY` (必需): OpenRouter API 金鑰
    - `OPENROUTER_MODEL` (可選): 模型名稱，預設為 `openai/gpt-oss-20b:free`
    - `additionalContext` 或 `a` (可選): 對話的額外上下文描述
    - `output_lang` (可選): 輸出語言，支持 `en` 和 `zh-TW`，預設為 `en`
  - 請求體：FormData 格式，包含 `file` 字段（JSON 或 CSV 文件）
  - 支持的文件格式：
    - JSON: 評論數組或包含 comments 字段的對象
    - CSV: 包含 comment-id、comment_text 和投票數據的表格

### 技術棧

- **運行時**: Cloudflare Workers
- **語言**: TypeScript
- **構建工具**: Wrangler
- **測試框架**: Vitest
- **依賴**: sensemaking-tools

### 系統要求

- Node.js 18.0 或更高版本
- npm 或 yarn 包管理器
- Cloudflare 帳戶（用於部署）

### 安裝步驟

1. **克隆項目**
   ```bash
   git clone <repository-url>
   cd sensemaker-backend
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **配置環境變數**
   - 複製 `.env.example` 為 `.env` 文件
   - 填入您的 OpenRouter API 金鑰和模型配置
   - 或者直接在 `wrangler.jsonc` 中配置環境變數
   - 確保 sensemaking-tools 庫在正確的路徑 (`../sensemaking-tools/library`)
   - 如果需要，配置 Cloudflare 認證

### 開發

#### 本地開發服務器

啟動開發服務器：
```bash
npm run dev
```

服務器將在 `http://localhost:8787` 上運行。



安裝lite-server：

```bash
npm install -g lite-server
```

啟動測試前端：
```bash
lite-server
```

訪問
```bash
http://localhost:3000/test-api.html
```

#### 其他開發命令

- **啟動服務**: `npm start` (等同於 `npm run dev`)
- **運行測試**: `npm test`
- **生成 Cloudflare 類型**: `npm run cf-typegen`

#### 項目結構

```
sensemaker-backend/
├── src/
│   └── index.ts          # 主要入口文件
├── public/               # 靜態資源
├── test/                 # 測試文件
├── wrangler.jsonc        # Cloudflare Workers 配置
├── tsconfig.json         # TypeScript 配置
└── package.json          # 項目依賴和腳本
```

### 部署

#### 部署到 Cloudflare Workers

1. **確保已登錄 Wrangler**
   ```bash
   npx wrangler login
   ```

2. **部署項目**
   ```bash
   npm run deploy
   ```

#### 部署配置

部署配置在 `wrangler.jsonc` 文件中：
- 項目名稱: `sensemaker-backend`
- 兼容性日期: `2024-01-01`
- 靜態資源目錄: `./public`
- 可觀測性: 已啟用

### 測試

使用 Vitest 運行測試：
```bash
npm test
```

測試文件位於 `test/` 目錄中。

### 使用示例

#### 1. 健康檢查
```bash
curl http://localhost:8787/api/test
```

#### 2. 分析評論數據
```bash
# 使用 curl 發送請求
curl -X POST \
  "http://localhost:8787/api/sensemake?OPENROUTER_API_KEY=your_api_key&OPENROUTER_MODEL=openai/gpt-oss-20b:free&additionalContext=產品評論討論&output_lang=zh-TW" \
  -F "file=@comments.json"
```

#### 3. 測試頁面
項目包含一個測試頁面 `test-api.html`，您可以在瀏覽器中打開它來測試 API 功能。

#### 4. 示例數據
項目包含示例數據文件：
- `example-data.json` - JSON 格式的示例評論數據
- `example-data.csv` - CSV 格式的示例評論數據（簡單投票格式）
- `example-data-grouped.csv` - CSV 格式的示例評論數據（群組投票格式）

您可以使用這些文件來測試 API 功能。

### 環境變數配置

#### 本地開發環境 (推薦)
```bash
# 複製示例文件
cp .dev.vars.example .dev.vars

# 編輯 .dev.vars 文件
OPENROUTER_API_KEY=your_actual_api_key_here
OPENROUTER_MODEL=openai/gpt-oss-20b:free
IS_DEVELOPMENT=true
```

**注意**: `.dev.vars` 文件已經在 `.gitignore` 中，不會被提交到版本控制，可以安全地存放 API 金鑰。

#### 傳統方式 (可選)
```bash
# 複製示例文件
cp env.example .env

# 編輯 .env 文件
OPENROUTER_API_KEY=your_actual_api_key_here
OPENROUTER_MODEL=openai/gpt-oss-20b:free
```

#### 通過查詢參數傳遞（可選）
```bash
curl -X POST \
  "http://localhost:8787/api/sensemake?OPENROUTER_API_KEY=your_key&OPENROUTER_MODEL=your_model" \
  -F "file=@data.json"
```

**優先級**: 查詢參數 > 環境變數 > 預設值

### 數據格式

#### JSON 格式
```json
[
  {
    "id": "comment-1",
    "text": "這個產品真的很棒，使用起來非常方便！",
    "votes": {
      "agrees": 15,
      "disagrees": 2,
      "passes": 1
    }
  }
]
```

#### CSV 格式
```csv
comment-id,comment_text,agrees,disagrees,passes
comment-1,這個產品真的很棒使用起來非常方便,15,2,1
comment-2,界面設計很美觀功能也很實用,12,1,0
```

### 故障排除

#### 常見問題

1. **依賴問題**: 確保 sensemaking-tools 庫路徑正確
2. **類型錯誤**: 運行 `npm run cf-typegen` 重新生成類型
3. **部署失敗**: 檢查 Cloudflare 認證和配置

#### 獲取幫助

- 查看 [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- 檢查項目 issue 和討論

---

## English

### Project Overview

Sensemaker Backend is a backend service built on Cloudflare Workers, integrating the sensemaking-tools library to provide intelligent analysis and processing capabilities.

#### API Endpoints

- **GET /** - Health check endpoint
- **POST /api/sensemake** - Intelligent comment data analysis
  - Query parameters:
    - `OPENROUTER_API_KEY` (required): OpenRouter API key
    - `OPENROUTER_MODEL` (optional): Model name, defaults to `openai/gpt-oss-20b:free`
    - `additionalContext` or `a` (optional): Additional context description for the conversation
    - `output_lang` (optional): Output language, supports `en` and `zh-TW`, defaults to `en`
  - Request body: FormData format with `file` field (JSON or CSV file)
  - Supported file formats:
    - JSON: Array of comments or object with comments field
    - CSV: Table with comment-id, comment_text and voting data columns

### Technology Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Build Tool**: Wrangler
- **Testing Framework**: Vitest
- **Dependencies**: sensemaking-tools

### System Requirements

- Node.js 18.0 or higher
- npm or yarn package manager
- Cloudflare account (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sensemaker-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy `.env.example` to `.env` file
   - Fill in your OpenRouter API key and model configuration
   - Or configure environment variables directly in `wrangler.jsonc`
   - Ensure the sensemaking-tools library is in the correct path (`../sensemaking-tools/library`)
   - Configure Cloudflare authentication if needed

### Development

#### Local Development Server

Start the development server:
```bash
npm run dev
```

The server will run on `http://localhost:8787`.

#### Other Development Commands

- **Start service**: `npm start` (equivalent to `npm run dev`)
- **Run tests**: `npm test`
- **Generate Cloudflare types**: `npm run cf-typegen`

#### Project Structure

```
sensemaker-backend/
├── src/
│   └── index.ts          # Main entry file
├── public/               # Static assets
├── test/                 # Test files
├── wrangler.jsonc        # Cloudflare Workers configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Project dependencies and scripts
```

### Deployment

#### Deploy to Cloudflare Workers

1. **Ensure Wrangler is logged in**
   ```bash
   npx wrangler login
   ```

2. **Deploy the project**
   ```bash
   npm run deploy
   ```

#### Deployment Configuration

Deployment configuration is in `wrangler.jsonc`:
- Project name: `sensemaker-backend`
- Compatibility date: `2024-01-01`
- Static assets directory: `./public`
- Observability: Enabled

### Testing

Run tests using Vitest:
```bash
npm test
```

Test files are located in the `test/` directory.

### Usage Examples

#### 1. Health Check
```bash
curl http://localhost:8787/api/test
```

#### 2. Analyze Comment Data
```bash
# Using curl to send request
curl -X POST \
  "http://localhost:8787/api/sensemake?OPENROUTER_API_KEY=your_api_key&OPENROUTER_MODEL=openai/gpt-oss-20b:free&additionalContext=Product review discussion&output_lang=en" \
  -F "file=@comments.json"
```

#### 3. Test Page
The project includes a test page `test-api.html` that you can open in your browser to test the API functionality.

#### 4. Sample Data
The project includes sample data files:
- `example-data.json` - Sample comment data in JSON format
- `example-data.csv` - Sample comment data in CSV format (simple voting format)
- `example-data-grouped.csv` - Sample comment data in CSV format (grouped voting format)

You can use these files to test the API functionality.

### Environment Variables Configuration

#### Local Development Environment
```bash
# Copy example file
cp .env.example .env

# Edit .env file
OPENROUTER_API_KEY=your_actual_api_key_here
OPENROUTER_MODEL=openai/gpt-oss-20b:free
```

**Note**: The `.env` file is already in `.gitignore` and won't be committed to version control, so it's safe to store API keys.

#### Passing via Query Parameters (Optional)
```bash
curl -X POST \
  "http://localhost:8787/api/sensemake?OPENROUTER_API_KEY=your_key&OPENROUTER_MODEL=your_model" \
  -F "file=@data.json"
```

**Priority**: Query parameters > Environment variables > Default values

### Data Formats

#### JSON Format
```json
[
  {
    "id": "comment-1",
    "text": "This product is really great and very convenient to use!",
    "votes": {
      "agrees": 15,
      "disagrees": 2,
      "passes": 1
    }
  }
]
```

#### CSV Format
```csv
comment-id,comment_text,agrees,disagrees,passes
comment-1,This product is really great and very convenient to use,15,2,1
comment-2,The interface design is beautiful and functional,12,1,0
```

### Troubleshooting

#### Common Issues

1. **Dependency issues**: Ensure the sensemaking-tools library path is correct
2. **Type errors**: Run `npm run cf-typegen` to regenerate types
3. **Deployment failures**: Check Cloudflare authentication and configuration

#### Getting Help

- Check [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- Review project issues and discussions

---

## License

[Add your license information here]
