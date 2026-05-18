---
name: _system
description: >
  專案記憶：Multi-MCP Gateway 系統層級資訊（技術堆疊、主機環境、部署設定）。 Use when: 任何涉及 系統架構/技術堆疊/部署/MCP
  伺服器管理 的任務。
metadata:
  author: antigravity
  version: '1.0'
  origin: tech-stack-protocol
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
last_updated: '2026-05-18T21:58:10+08:00'
status: stable
staleness: 0
---

# Multi-MCP Gateway — System Memory

## Tech Stack
- **語言**: TypeScript 5.7+ (strict, ES2022, Node16 module)
- **執行環境**: Node.js (ESM, `type: module`)
- **核心依賴**: `@modelcontextprotocol/sdk ^1.29.0`
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
| gitnexus | 開發工具 | npx --package gitnexus@1.6.5 -- gitnexus mcp | 無需認證 |
| sequentialthinking | 輔助工具 | npx --package @modelcontextprotocol/server-sequential-thinking@latest -- mcp-server-sequential-thinking | 無需認證 |
| cloudflare-bindings | 雲端基礎設施 | mcp-remote (bindings.mcp.cloudflare) | env (CLOUDFLARE_API_TOKEN，已停用 `.disabled`) |
| cloudflare-containers | 雲端基礎設施 | mcp-remote (containers.mcp.cloudflare) | env (CLOUDFLARE_API_TOKEN，已停用 `.disabled`) |
| cloudflare-observability | 雲端基礎設施 | mcp-remote (observability.mcp.cloudflare) | env (CLOUDFLARE_API_TOKEN，已停用 `.disabled`) |
| eslint | 程式碼品質 | @eslint/mcp | 無需認證（已停用） |
| snyk | 安全掃描 | snyk mcp (內建 CLI) | 本地 Token（snyk auth） |
| excel | 資料處理 | npx --package @shmaxi/excel-mcp-server@latest -- excel-mcp-server stdio | 無需認證 |
| sentry | 錯誤監控 | @sentry/mcp-server | env (SENTRY_AUTH_TOKEN) |
| playwright | 網頁測試 | npx --package @playwright/mcp@latest -- playwright-mcp | 無需認證 |
| a11y | 網頁測試 | npx --package accessibility-mcp@latest -- accessibility-mcp | 無需認證 |
| context7 | 文件查詢 | npx --package @upstash/context7-mcp@latest -- context7-mcp | 無需認證 |
| cartridge-system | 記憶管理 | npx --package cartridge-system@latest -- cartridge-system | 無需認證 |
| swarm-mcp | 輔助工具 | 本地 swarm-mcp dist/index.js | 無需認證（`.disabled` 保留設定，不由 Gateway 載入） |
| trunk | 程式碼品質 | https://mcp.trunk.io/mcp (HTTP) | OAuth（/mcp auth trunk） |

## Config Architecture
- npm package 只承載程式碼與公開資源；使用者設定、金鑰、MCP 清單與 registry 預設放在本機使用者資料夾
- 預設使用者資料夾：Windows `%APPDATA%\multi-mcp-gateway`、macOS `~/Library/Application Support/multi-mcp-gateway`、Linux `$XDG_CONFIG_HOME/multi-mcp-gateway` 或 `~/.config/multi-mcp-gateway`
- `MULTI_MCP_HOME` — 覆寫使用者資料夾；開發驗證可指向 repo 根目錄以沿用示範設定
- `gateway.config.json` — 閘道器設定（超時、重試、日誌等級），相對路徑以此檔案所在資料夾解析
- `gateway.env` — 認證檔案（由 CLI 主控台自動產生）
- `default-mcps.seed.json` — 預設 MCP 一次性初始化紀錄；存在時不再自動補回被刪除的預設 MCP，屬於 user-data 產物且已由 `.gitignore` 排除
- `.npmrc` — 固定 npm script shell 為 `cmd.exe`，避免 Windows session 缺少 `ComSpec` 時 npm script 無法 spawn
- `credentials.json` — 多帳號認證儲存（明文，已被 .gitignore 排除）
- `mcps/` — 分類目錄式 MCP 設定（JSON 檔）
- `registry.json` — 掃描產出的工具集成表
- `mcp-catalog.json` — npm package 內建推薦清單；CLI 讀 package 內檔案，不寫入使用者資料夾
- `dist/` — TypeScript 編譯產物；被 `.gitignore` 排除但 Codex/Gemini MCP runtime 以 `node d:/Multi-MCP/dist/index.js` 啟動，修改 `src/` 後必須先 build 並重啟 MCP 連線
- `scripts/verify-gateway-runtime.mjs` — 以 MCP stdio 啟動 `dist/index.js`，驗證 Gateway 管理工具描述、搜尋流程與 cartridge-system 12 個工具
- `.agents/memory/` — 唯一提交到 Git 的 Antigravity agents 目錄；`.agents` 其他框架、技能、工作流檔案為本機 ignored 狀態
- `.cartridge/` — Cartridge System 本機索引產物；被 `.gitignore` 排除，不提交
- `C:\Users\homeb\.gemini\antigravity\mcp_config.json` — Gemini IDE 全域 MCP 設定（含 Trunk HTTP 端點）

## Key Scripts
- `npm run dev` — 開發模式啟動閘道器
- `npm run dev:scan` — 開發模式掃描工具
- `npm run console` — CLI 管理主控台
- `npm test` — 單元測試 (vitest)
- `npx tsc` — 直接編譯到 `dist/`；`.npmrc` 已固定 npm script shell，`npm run build` 與 `npx tsc` 皆可作為建置入口
- `npm run verify:runtime` — 驗證 `dist/` runtime 實際暴露新版 Gateway 工具與 cartridge-system 12 個工具；開發時以 `MULTI_MCP_HOME` 指向 repo 根目錄
- `npm run preflight:gateway` — typecheck、核心測試、build、runtime verify 的完整 Gateway 上線前檢查
- `npm pack --dry-run --json` — 檢查 npm 發布內容；白名單只應包含 `dist/`、`mcp-catalog.json`、README、CHANGELOG 與 package metadata

## Tracked Files
- README.md
- CHANGELOG.md
- .npmrc
- package.json
- package-lock.json
- tsconfig.json
- mcp-catalog.json
- gateway.config.json
- .gitignore
- mcps/程式碼品質/eslint.json.disabled
- mcps/安全掃描/snyk.json.disabled
- mcps/資料處理/excel.json
- mcps/錯誤監控/sentry.json
- mcps/網頁測試/playwright.json
- mcps/網頁測試/a11y.json
- mcps/文件查詢/context7.json
- mcps/開發工具/gitnexus.json
- mcps/開發工具/github.json
- mcps/UI設計/stitch.json
- mcps/輔助工具/swarm-mcp.disabled
- mcps/輔助工具/sequentialthinking.json
- mcps/雲端基礎設施/cloudflare-bindings.disabled
- mcps/雲端基礎設施/cloudflare-observability.disabled
- mcps/雲端基礎設施/cloudflare-containers.disabled
- mcps/記憶管理/cartridge-system.json

## Key Decisions
- D01: 使用 `mcps/` 分類目錄結構取代單一設定檔，便於管理大量 MCP
- D02: `gateway.env` 由 CLI 自動產生，不建議手動編輯
- D03: `credentials.json` 儲存多帳號明文密鑰，依賴 `.gitignore` 保護
- D04: 審計 MCP 選擇「本地執行」策略，排除雲端掃描（Semgrep）以保護隱私
- D05: Snyk MCP 使用 `--experimental` 旗標，需留意未來版本相容性
- D06: 審計工作流採「CLI 子代理 + 合併報告 + 主腦只讀」架構，實現上下文隔離
- D07: Context7 MCP 用於即時查詢框架官方文件，零外部依賴、無需 API Key
- D08: Trunk MCP 採 HTTP 傳輸（路徑 A），直接寫入 Gemini IDE 全域設定，繞過 Gateway；Gateway 目前僅支援 stdio，HTTP 傳輸需未來擴充
- D09: `mcps/**/*.disabled` 檔案作為停用 MCP 的保留設定；`config-loader` 只載入 `.json`，所以 `mcps/輔助工具/swarm-mcp.disabled` 不會註冊到 Gateway
- D10: `.gitignore` 採「忽略 `.agents/*`、只放行 `.agents/memory/`」策略；rules、skills、workflows、scripts、VERSION 屬於本機框架檔，不進倉庫
- D11: `.cartridge/` 是本機記憶索引快取，不進倉庫；跨機器 clone 後需重新掃描或由 cartridge-system 重建索引
- D12: Gateway MCP runtime 指向 `dist/index.js`，因此只改 `src/` 不會影響已連線 MCP；完成原始碼變更後必須編譯 `dist/` 並重啟 MCP 連線，否則 Codex tool discovery 可能仍讀到舊工具 metadata
- D13: `dist/index.js` server mode 會在啟動前檢查非測試 `src/**/*.ts` 是否比 `dist/**/*.js` 新；若 stale 則拒絕啟動，防止其他 AI 或人類忘記 build 後連到舊 Gateway
- D14: `verify:runtime` 需覆蓋 Gateway 實際 MCP 呼叫的關鍵 AI 行為提示，包含工具發現、cartridge-system 工具數量與錯參數診斷
- D15: A 方案採本機 stdio + npm 一行啟動，不建置雲端 SaaS 或 HTTP transport；MCP Client 設定使用 `npx -y multi-mcp-gateway@latest`
- D16: 發布內容採 `package.json.files` 白名單，避免把 `.agents/`、`mcps/`、`gateway.env`、`credentials.json`、測試輸出或治理資料打進 npm package
- D17: `MULTI_MCP_HOME` 是唯一正式的使用者資料夾覆寫入口；測試與 runtime verify 可用它將資料位置指回 repo
- D18: `1.0.0` 作為 npm 公開發布候選版；正式 `npm publish` 前必須完成完整健檢、tarball smoke 與 npm 套件名稱/登入狀態檢查
- D19: 1.0.0 發布前供應鏈門檻要求 `npm audit --omit=dev --json` 與 `npm audit --json` 皆為 0 vulnerabilities；若 npm 未登入，視為 publish blocker 但不影響程式碼發布候選狀態
- D20: `1.1.0` 作為跨專案 workspace 安全修正版；Gateway 不保存固定全域專案路徑，所有下游工具呼叫必須透過 `gateway__call_tool.workspace` 明確帶入當前專案絕對路徑
- D21: `mcps/記憶管理/cartridge-system.json` 改用 npm runtime `npx -y --package cartridge-system@latest -- cartridge-system`，不再依賴本機 `d:/cartridge_system/dist/mcp-server.js` 或固定 `--workspace`
- D22: `1.1.1` 起首次 user-data 初始化會一次性 seed 可攜、無金鑰 MCP；seed marker 存在後尊重使用者刪除，不會自動補回
- D23: `mcps/開發工具/gitnexus.json` 改用 npm runtime `npx -y --package gitnexus@1.6.5 -- gitnexus mcp`，禁止公開設定依賴 `C:\gitnexus-src\...` 這類本機絕對路徑
- D24: 1.1.1 預設 seed 全部採 explicit package 形式 `npx -y --package <pkg> -- <bin>`；tarball smoke 已驗證直接 `npx -y <pkg>@latest` 在 Windows nested npx 情境會誤解析
- D25: Cloudflare bindings、containers、observability 設定改以 `.disabled` 檔保留，`_system` 只追蹤實際存在的 disabled 檔，不再追蹤已刪除的 `.json` 路徑。
- D26: `default-mcps.seed.json` 是使用者資料 marker；開發驗證若以 repo root 作為 `MULTI_MCP_HOME` 會產生此檔，因此必須被 `.gitignore` 排除且不得提交。

## Known Issues
- credentials.json 明文儲存密鑰，依賴 .gitignore 保護，缺少加密層
- Snyk MCP 仍在實驗階段（`--experimental`），API 可能不相容變更
- 遠端 MCP（Stitch、Cloudflare）掃描時偶發 AbortError 超時
- Trunk MCP 不在 Gateway 統一管理範疇，認證狀態無法透過 gateway__auth_status 監控
- swarm-mcp 目前以 `.disabled` 保留設定，需重新命名為 `.json` 並 rescan 後才會進入 Gateway registry
- `.npmrc` 固定 npm script shell 後，`npm run build` 不再依賴當前 session 的 `ComSpec` 是否存在；若系統 cmd.exe 路徑異常仍可改用 `npx tsc`
- Codex 當前 session 的 MCP stdio transport 被手動終止後不一定自動重連；需要重啟 Codex session 或重新載入 MCP 連線，才能讓 tool discovery 使用最新 `dist/`

## Module Lessons
- L01: ESLint MCP 掃描 TypeScript 需要目標專案自備 `eslint.config.*` + TypeScript parser
- L02: 不同專案的 ESLint 外掛版本可能與 ESLint MCP 版本不相容（Bartender Map 的 react/display-name）
- L03: Gateway 掃描 8+ 個 MCP 時，遠端伺服器可能超時但不影響本地 MCP 註冊
- L04: npx 首次下載新套件時掃描易超時（registry 記錄 0 工具），需先手動 `npx -y <pkg> --help` 預下載後再 rescan
- L05: 社群維護的 A11y MCP（@mseep/a11y-mcp、accessibility-mcp）在 Gateway 掃描時回傳 0 工具，可能是 MCP 協議實作不完整或初始化逾時
- L06: devDependencies 的間接依賴漏洞（如 picomatch ReDoS、path-to-regexp ReDoS）不影響生產執行期，可安全透過 `npm audit fix` 自動排除，可跟蹤 `npm test` 確認零迴歸
- L07: 記憶卡夾系統停用時，記憶卡需手動更新；恢復後應優先重啟並同步過期索引
- L08: Trunk MCP 使用 HTTP 傳輸，Gemini IDE `mcp_config.json` 需用 `serverURL` 欄位（非 `httpUrl`）；`httpUrl` 是 `.gemini/settings.json` 格式，兩者欄位名稱不同
- L09: 停用 MCP 時不要讓記憶卡繼續追蹤不存在的 `.json` 路徑；應改追蹤實際保留的 `.disabled` 檔，避免 ghost file 阻塞提交前檢查
- L10: 修改 Gateway 工具描述後，必須同時驗證 `src/` 測試與實際 `dist/` runtime；`tool_search` 顯示舊描述通常代表 MCP 連線仍在使用舊編譯品或舊 metadata 快取
- L11: 已連線的 Codex/Gemini MCP process 不會因 `npm run build` 自動熱更新；新 runtime 行為可由 `verify:runtime` 驗證，但目前 IDE 連線仍需重啟後才會看到新 Gateway 訊息
- L12: npm package 化後，公開可複製命令也是產品面；README 需同時提供 MCP client JSON、管理台 `console`、`--scan`、`MULTI_MCP_HOME` 與發布 dry-run 驗證方式
- L13: Windows 本機 tarball smoke 應使用 `npx -y --package <tgz> -- multi-mcp-gateway ...` 驗證 bin；直接 `npx -y <tgz>` 可能 exit 0 但未穩定啟動 package bin
- L14: MCP SDK minor 升級不一定會刷新間接依賴；發布前安全修復需在升級後跑 `npm audit fix`，確認 lockfile 實際解析到 patched transitive versions
- L15: cartridge-system 5.2.0 起可直接作為 npm MCP runtime；在 Multi-MCP Gateway 內應避免下游設定固定 `--workspace`，由每次 `gateway__call_tool.workspace` 決定目標專案
- L16: 預設 MCP 不應透過 npm package 打包整個 `mcps/`，而應由初始化流程在 user-data 產生；這能避免私人路徑、金鑰佔位與 disabled 設定被公開發布
- L17: `gitnexus@latest` 在 Windows npx smoke 中可能觸發 npm exec 錯誤；預設 seed 應使用已驗證的 explicit `--package gitnexus@1.6.5 -- gitnexus mcp` 形式，等 latest 修復後再放寬
- L18: Gateway 若本身由 `npx --package <tgz>` 啟動，下游 `npx -y <pkg>@latest` 可能被 cmd 拆成錯誤指令；預設 seed 與 smoke 測試需使用 explicit package 形態驗證

## Relations
- gateway-core
- cli
