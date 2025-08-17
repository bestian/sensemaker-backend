# Sensemaker Backend

[English](#english) | [中文](#chinese)

---

## 中文

### 項目簡介

Sensemaker Backend 是一個基於 Cloudflare Workers 的後端服務，集成了 sensemaking-tools 庫，提供智能分析和處理功能。

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

3. **配置環境**
   - 確保 sensemaking-tools 庫在正確的路徑 (`../sensemaking-tools/library`)
   - 如果需要，配置 Cloudflare 認證

### 開發

#### 本地開發服務器

啟動開發服務器：
```bash
npm run dev
```

服務器將在 `http://localhost:8787` 上運行。

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

3. **Configure environment**
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
