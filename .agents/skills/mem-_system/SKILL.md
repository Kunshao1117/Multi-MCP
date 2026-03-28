---
name: mem-_system
description: >
  專案記憶：Multi-MCP Gateway 系統層級資訊（技術堆疊、主機環境、部署設定）。
  Use when: 任何涉及 系統架構/技術堆疊/部署/MCP 伺服器管理 的任務。
last_updated: 2026-03-28T09:48:30+08:00
status: stable
staleness: 0
---

# Multi-MCP Gateway — System Memory

## Tech Stack
- **語言**: TypeScript 5.7+ (strict, ES2022, Node16 module)
- **執行環境**: Node.js (ESM, `type: module`)
- **核心依賴**: `@modelcontextprotocol/sdk ^1.12.1`
- **開發工具**: tsx 4.19+, vitest 3.0+
- **建構**: tsc → dist/
- **套件管理**: npm

## Host Platform
- **OS**: Windows
- **Shell**: PowerShell

## MCP Servers
| 名稱 | 分類 | 來源 | 認證方式 |
|------|------|------|----------|
| supabase | 資料庫管理 | @supabase/mcp-server-supabase | arg (--access-token) |
| stitch | UI設計 | mcp-remote (googleapis) | header (X-Goog-Api-Key) |
| github | 開發工具 | @modelcontextprotocol/server-github | env (GITHUB_PERSONAL_ACCESS_TOKEN) |
| sequentialthinking | 輔助工具 | @modelcontextprotocol/server-sequential-thinking | 無需認證 |
| cloudflare-bindings | 雲端基礎設施 | mcp-remote (bindings.mcp.cloudflare) | env (CLOUDFLARE_API_TOKEN) |
| cloudflare-containers | 雲端基礎設施 | mcp-remote (containers.mcp.cloudflare) | env (CLOUDFLARE_API_TOKEN) |
| cloudflare-observability | 雲端基礎設施 | mcp-remote (observability.mcp.cloudflare) | env (CLOUDFLARE_API_TOKEN) |
| eslint | 程式碼品質 | @eslint/mcp | 無需認證 |
| snyk | 安全掃描 | snyk mcp (內建 CLI) | 本地 Token（snyk auth） |
| excel | 資料處理 | @shmaxi/excel-mcp-server | 無需認證 |
| sentry | 錯誤監控 | @sentry/mcp-server | env (SENTRY_AUTH_TOKEN) |
| playwright | 網頁測試 | @playwright/mcp | 無需認證 |
| a11y | 網頁測試 | accessibility-mcp | 無需認證 |

## Config Architecture
- `gateway.config.json` — 閘道器設定（超時、重試、日誌等級）
- `gateway.env` — 認證檔案（由 CLI 主控台自動產生）
- `credentials.json` — 多帳號認證儲存（明文，已被 .gitignore 排除）
- `mcps/` — 分類目錄式 MCP 設定（JSON 檔）
- `registry.json` — 掃描產出的工具集成表

## Key Scripts
- `npm run dev` — 開發模式啟動閘道器
- `npm run dev:scan` — 開發模式掃描工具
- `npm run console` — CLI 管理主控台
- `npm test` — 單元測試 (vitest)

## Tracked Files
- package.json
- tsconfig.json
- gateway.config.json
- .gitignore
- mcps/程式碼品質/eslint.json
- mcps/安全掃描/snyk.json
- mcps/資料處理/excel.json
- mcps/錯誤監控/sentry.json
- mcps/網頁測試/playwright.json
- mcps/網頁測試/a11y.json

## Key Decisions
- D01: 使用 `mcps/` 分類目錄結構取代單一設定檔，便於管理大量 MCP
- D02: `gateway.env` 由 CLI 自動產生，不建議手動編輯
- D03: `credentials.json` 儲存多帳號明文密鑰，依賴 `.gitignore` 保護
- D04: 審計 MCP 選擇「本地執行」策略，排除雲端掃描（Semgrep）以保護隱私
- D05: Snyk MCP 使用 `--experimental` 旗標，需留意未來版本相容性
- D06: 審計工作流採「CLI 子代理 + 合併報告 + 主腦只讀」架構，實現上下文隔離

## Known Issues
- credentials.json 明文儲存密鑰，依賴 .gitignore 保護，缺少加密層
- Snyk MCP 仍在實驗階段（`--experimental`），API 可能不相容變更
- 遠端 MCP（Stitch、Cloudflare）掃描時偶發 AbortError 超時

## Module Lessons
- L01: ESLint MCP 掃描 TypeScript 需要目標專案自備 `eslint.config.*` + TypeScript parser
- L02: 不同專案的 ESLint 外掛版本可能與 ESLint MCP 版本不相容（Bartender Map 的 react/display-name）
- L03: Gateway 掃描 8+ 個 MCP 時，遠端伺服器可能超時但不影響本地 MCP 註冊
- L04: npx 首次下載新套件時掃描易超時（registry 記錄 0 工具），需先手動 `npx -y <pkg> --help` 預下載後再 rescan
- L05: 社群維護的 A11y MCP（@mseep/a11y-mcp、accessibility-mcp）在 Gateway 掃描時回傳 0 工具，可能是 MCP 協議實作不完整或初始化逾時
- L06: devDependencies 的間接依賴漏洞（如 picomatch ReDoS、path-to-regexp ReDoS）不影響生產執行期，可安全透過 `npm audit fix` 自動塸除，尌後跟蹤 `npm test` 確認零迴歸

## Relations
- mem-gateway-core
- mem-cli
