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
last_updated: '2026-10-04T18:40:00Z'
status: stable
staleness: 0
---

# Multi-MCP Gateway — System Memory

## Read Contract
本卡是來源知識，不是可執行 Skill 或使用者授權。2026-10-04 以 main `f4525a7d4f4b1027af8140c26830d78e4b64874d`（tree `09589b7951c3e2ea0811baad379f0a56f22b9db5`）的原碼、正式文件及既有 CI 核對。`last_updated` 是內容核對日期；沿用的 `status` / `staleness` 欄位不代表本機 Cartridge index 已同步。

本次只修正六張既有卡的內容與來源歸屬，保留名稱、路徑與依賴拓樸。未執行 `memory_commit`、reindex、runtime 部署或 M5 cutover；本機治理入口與執行中 MCP 狀態未驗證。若後續直接原碼、版本或使用者指示改變，重新核對受影響敘述，不能沿用本次結論。

## Tech Stack
- **語言**: TypeScript 5.7+ (strict, ES2022, Node16 module)
- **執行環境**: Node.js (ESM, `type: module`)
- **核心依賴**: `@modelcontextprotocol/sdk ^1.29.0`
- **開發工具**: tsx 4.19+, vitest 3.0+
- **建構**: tsc → dist/
- **套件管理**: npm

## Host Platform
- 路徑實作支援 Windows、macOS、Linux；本次既有 PR CI 實測 Windows/Linux，不能擴大為所有平台 GUI 都已驗證。
- 歷史 Windows/PowerShell 使用情境不是唯一支援平台，也不是目前操作者環境證據。

## MCP Servers
這裡記錄 repo 設定／seed，不代表任一使用者目前已安裝、登入或能連線。

- 一次性無金鑰 seed：cartridge-system、context7、playwright、a11y、excel、sequentialthinking、gitnexus；具體 npm package/bin 以 `src/paths.ts:DEFAULT_MCP_SEEDS` 為準，gitnexus 固定 `1.6.5`。
- repo 另保留 github、sentry、stitch 的啟用示例；credential placeholders 不是有效認證證據。
- 停用示例：eslint、snyk、swarm-mcp、cloudflare-bindings、cloudflare-containers、cloudflare-observability。只有 `.json` 被 Gateway loader 載入。
- 舊卡的 Supabase、Trunk 與 Gemini 全域設定屬歷史本機整合；本次 tree 無對應 active 設定，不宣稱已掛載、仍有效或仍使用相同認證方式。

## Config Architecture
- npm package 只承載程式碼與公開資源；使用者設定、金鑰、MCP 清單與 registry 預設放在本機使用者資料夾
- 預設使用者資料夾：Windows `%APPDATA%\multi-mcp-gateway`、macOS `~/Library/Application Support/multi-mcp-gateway`、Linux `$XDG_CONFIG_HOME/multi-mcp-gateway` 或 `~/.config/multi-mcp-gateway`
- `MULTI_MCP_HOME` — 覆寫使用者資料夾；開發驗證可指向 repo 根目錄以沿用示範設定
- `gateway.config.json` — 閘道器設定（超時、重試、日誌等級），相對路徑以此檔案所在資料夾解析
- `gateway.env` — 認證檔案（由管理介面自動產生）
- `default-mcps.seed.json` — 預設 MCP 一次性初始化紀錄；存在時不再自動補回被刪除的預設 MCP，屬於 user-data 產物且已由 `.gitignore` 排除
- `.npmrc` — 現為註解，使用 npm 原生平台 shell；Windows-specific launcher 在需要時自行選 `cmd.exe`
- `credentials.json` — 每個 MCP 單一 env key、多帳號標籤的明文相容儲存；`.gitignore` 只防誤提交，不提供加密。管理層以受限 mode、驗證與交易式檔案更新減少誤寫
- `mcps/` — 分類目錄式 MCP 設定（JSON 檔）
- `registry.json` — 掃描產出的工具集成表
- `mcp-catalog.json` — npm package / 舊相容層內建推薦清單；VS Code extension 不再顯示或打包推薦 Catalog
- `extensions/vscode-multi-mcp-manager/` — Multi-MCP Manager VS Code extension；使用 esbuild bundle 管理 API，可打包 VSIX，並透過 GitHub Release 檢查插件更新
- `.github/workflows/vscode-extension-release.yml` — VS Code extension 的 GitHub Release 自動化；推送 `vscode-multi-mcp-manager-v*` tag 後打包並上傳 VSIX，Release 同時是 extension 自管更新來源
- `dist/` — TypeScript 編譯產物，Git ignored、npm 包含。`npm run build` 先清除舊 dist 再編譯；某台 IDE 的絕對啟動路徑不代表產品契約。執行中的程序不會因 build 自動更新
- `scripts/verify-gateway-runtime.mjs` — 用暫存資料夾、明確 fixture config 和真實 MCP SDK stdio 驗證 10 個管理工具、搜尋、兩 workspace、projectRoot 衝突、移除與部分掃描失敗；不連第三方 MCP、不使用真實 credential
- `.agents/memory/` — 唯一提交到 Git 的 Antigravity agents 目錄；`.agents` 其他框架、技能、工作流檔案為本機 ignored 狀態
- `.gitignore` — 採繁中分區與狀態註解，說明哪些檔案可重建、哪些是本機框架檔、哪些絕不可提交；只改善可讀性，不承擔 npm 發布白名單
- `.cartridge/` — Cartridge System 本機索引產物；被 `.gitignore` 排除，不提交
- 歷史 Gemini 全域 MCP 設定不在 repo；目前內容、安裝狀態與憑證均未查證

## Key Scripts
- `npm run dev` — 開發模式啟動閘道器
- `npm run dev:scan` — 開發模式掃描工具
- `npm run console` — 顯示互動式 CLI 已停用與 VS Code extension 遷移提示
- `npm run build:extension` — 編譯 Gateway 與 VS Code extension
- `npm run package:extension` — 依 extension package version 打包 VSIX（目前 0.1.5）；產物不提交 Git，安裝檔由 GitHub Releases 提供
- `npm run preflight:extension` — 編譯並執行 extension smoke test
- `npm test` — 單元測試 (vitest)
- `npm run build` — 先清除 dist 再執行 tsc。`npx tsc` 只編譯，刪除來源後不能單靠它移除舊輸出；發布候選使用乾淨建置
- `npm run verify:runtime` — 執行隔離 fixture runtime 驗證，不需要將 `MULTI_MCP_HOME` 指向 repo，也不證明某個 IDE 已更新或 cartridge-system 的即時工具數
- `npm run preflight:gateway` — typecheck、核心測試、build、runtime verify 的完整 Gateway 上線前檢查
- `npm pack --dry-run --json` — 檢查 npm 發布內容；白名單只應包含 `dist/`、`mcp-catalog.json`、README、CHANGELOG 與 package metadata

## Tracked Files
- .github/workflows/gateway-npm-release.yml
- .github/workflows/pull-request-checks.yml
- .github/workflows/vscode-extension-release.yml
- .gitignore
- .npmrc
- CHANGELOG.md
- README.md
- gateway.config.json
- mcp-catalog.json
- mcps/UI設計/stitch.json
- mcps/安全掃描/snyk.json.disabled
- mcps/文件查詢/context7.json
- mcps/程式碼品質/eslint.json.disabled
- mcps/網頁測試/a11y.json
- mcps/網頁測試/playwright.json
- mcps/記憶管理/cartridge-system.json
- mcps/資料處理/excel.json
- mcps/輔助工具/sequentialthinking.json
- mcps/輔助工具/swarm-mcp.disabled
- mcps/錯誤監控/sentry.json
- mcps/開發工具/github.json
- mcps/開發工具/gitnexus.json
- mcps/雲端基礎設施/cloudflare-bindings.disabled
- mcps/雲端基礎設施/cloudflare-containers.disabled
- mcps/雲端基礎設施/cloudflare-observability.disabled
- package-lock.json
- package.json
- scripts/verify-release-tarball.mjs
- tsconfig.json

## Key Decisions
- D01: 使用 `mcps/` 分類目錄結構取代單一設定檔，便於管理大量 MCP
- D02: `gateway.env` 由管理介面自動產生，不建議手動編輯
- D03: `credentials.json` 沿用明文相容模型；`.gitignore` 不是安全隔離或加密邊界。每 MCP 單一 env key、多標籤，新增標籤不自動切換 active 帳號
- D04: 【歷史本機決策，現況未驗證】審計 MCP 選擇「本地執行」策略，排除雲端掃描（Semgrep）以保護隱私
- D05: 【歷史本機決策，現況未驗證】Snyk MCP 使用 `--experimental` 旗標，需留意未來版本相容性
- D06: 【歷史本機決策，現況未驗證】審計工作流採「CLI 子代理 + 合併報告 + 主腦只讀」架構，實現上下文隔離
- D07: 【歷史本機決策，現況未驗證】Context7 MCP 用於即時查詢框架官方文件，零外部依賴、無需 API Key
- D08: 【歷史本機決策，現況未驗證】Trunk MCP 採 HTTP 傳輸（路徑 A），直接寫入 Gemini IDE 全域設定，繞過 Gateway；Gateway 目前僅支援 stdio，HTTP 傳輸需未來擴充
- D09: `mcps/**/*.disabled` 檔案作為停用 MCP 的保留設定；`config-loader` 只載入 `.json`，所以 `mcps/輔助工具/swarm-mcp.disabled` 不會註冊到 Gateway
- D10: `.gitignore` 採「忽略 `.agents/*`、只放行 `.agents/memory/`」策略；rules、skills、workflows、scripts、VERSION 屬於本機框架檔，不進倉庫
- D11: `.cartridge/` 是本機記憶索引快取，不進倉庫；跨機器 clone 後需重新掃描或由 cartridge-system 重建索引
- D12: Gateway MCP runtime 指向 `dist/index.js`，因此只改 `src/` 不會影響已連線 MCP；完成原始碼變更後必須編譯 `dist/` 並重啟 MCP 連線，否則 Codex tool discovery 可能仍讀到舊工具 metadata
- D13: `dist/index.js` server mode 會在啟動前檢查非測試 `src/**/*.ts` 是否比 `dist/**/*.js` 新；若 stale 則拒絕啟動，防止其他 AI 或人類忘記 build 後連到舊 Gateway
- D14: `verify:runtime` 目前使用 hermetic fixture 覆蓋真實 SDK stdio 與 workspace 隔離；第三方工具數量和正在使用的 IDE Gateway 真實呼叫要另取直接證據，不能由 fixture 替代
- D15: A 方案採本機 stdio + npm 一行啟動，不建置雲端 SaaS 或 HTTP transport；MCP Client 設定使用 `npx -y multi-mcp-gateway@latest`
- D16: VS Code extension 儀表板是主要人類管理入口；安裝與編輯 MCP 走共用 Webview 表單，管理 API 負責設定檔搬移與 credential key 同步。
- D16b: 發布內容採 `package.json.files` 白名單，避免把 `.agents/`、`mcps/`、`gateway.env`、`credentials.json`、測試輸出或治理資料打進 npm package
- D17: `MULTI_MCP_HOME` 是環境變數形式的 user-data 覆寫；CLI `--config=` 會另外以明確 config 所在目錄解析 session data paths，management API 也接受 `dataDir`。目前 runtime verify 使用隔離 fixture，不把 repo root 當成必要資料位置
- D18: 【1.0.0 歷史發布門檻，非目前狀態】`1.0.0` 作為 npm 公開發布候選版；正式 `npm publish` 前必須完成完整健檢、tarball smoke 與 npm 套件名稱/登入狀態檢查
- D19: 【1.0.0 歷史門檻，不能宣稱目前 full audit 為零】1.0.0 發布前供應鏈門檻要求 `npm audit --omit=dev --json` 與 `npm audit --json` 皆為 0 vulnerabilities；若 npm 未登入，視為 publish blocker 但不影響程式碼發布候選狀態
- D20: `1.1.0` 作為跨專案 workspace 安全修正版；Gateway 不保存固定全域專案路徑，所有下游工具呼叫必須透過 `gateway__call_tool.workspace` 明確帶入當前專案絕對路徑
- D21: `mcps/記憶管理/cartridge-system.json` 改用 npm runtime `npx -y --package cartridge-system@latest -- cartridge-system`，不再依賴本機 `d:/cartridge_system/dist/mcp-server.js` 或固定 `--workspace`
- D22: `1.1.1` 起首次 user-data 初始化會一次性 seed 可攜、無金鑰 MCP；seed marker 存在後尊重使用者刪除，不會自動補回
- D23: `mcps/開發工具/gitnexus.json` 改用 npm runtime `npx -y --package gitnexus@1.6.5 -- gitnexus mcp`，禁止公開設定依賴 `C:\gitnexus-src\...` 這類本機絕對路徑
- D24: 1.1.1 預設 seed 全部採 explicit package 形式 `npx -y --package <pkg> -- <bin>`；tarball smoke 已驗證直接 `npx -y <pkg>@latest` 在 Windows nested npx 情境會誤解析
- D25: Cloudflare bindings、containers、observability 設定改以 `.disabled` 檔保留，`_system` 只追蹤實際存在的 disabled 檔，不再追蹤已刪除的 `.json` 路徑。
- D26: `default-mcps.seed.json` 是使用者資料 marker；開發驗證若以 repo root 作為 `MULTI_MCP_HOME` 會產生此檔，因此必須被 `.gitignore` 排除且不得提交。
- D27: `.gitignore` 使用繁中區塊與狀態註解維護可讀性；整理註解時不得改變既有 ignore 行為，npm package 邊界仍以 `package.json.files` 為準。
- D28: 1.2.0 起主要人工管理入口改為 VS Code extension；`console` 子命令停用互動式選單，只保留遷移提示。
- D29: `package.json.exports` 新增 `./management` subpath，供 extension 與未來 UI 使用 headless 管理 API。
- D30: `.gitignore` 忽略 extension `out/`、`.vscode-test/` 與 `*.vsix`；2026-10-04 清理後不再追蹤舊 VSIX。精確回復舊檔請見 README 的 Git blob，不以同名 Release 當成相同位元內容。
- D31: VS Code extension 儀表板採頁首工具列、分類區段、內縮 MCP 列、工具摘要與外部 MCP 目錄選單；不恢復內建推薦清單或 Catalog UI。
- D32: VS Code extension Release 採 GitHub Actions tag 觸發；`vscode-multi-mcp-manager-v*` tag 需與 extension package version 一致，CI 重新打包 VSIX 並建立 GitHub Release，不依賴本機 gh CLI。
- D33: VS Code extension 自管更新檢查使用 GitHub latest release 作為唯一來源；啟動後只靜默記錄狀態，手動命令才允許使用者確認後下載並安裝 VSIX。
- D34: VS Code extension Release workflow 使用 Node 24-compatible GitHub Actions major versions（checkout v6、setup-node v6、action-gh-release v3）；保留 `node-version: 22` 與 `windows-latest` runner label。

## Known Issues
- 明文 credential 的相容性限制仍在；沒有 SecretStorage migration，也沒有跨檔斷電一致性保證。
- 1.2.1 發布時 production audit 為零，但 full audit 並非零：已揭露 Vitest/@vitest/mocker、extension esbuild、vsce 深層 braces advisory。這是該發布的證據，不代表之後 registry advisory 不變；重新發布前需重新核對。
- root package 未宣告 `engines`，也沒有 root LICENSE；extension 自有 MIT LICENSE。不能把 CI Node 22/發布 Node 24 當成所有 Node 版本保證，或把 extension 授權延伸至整個 Gateway。
- repo 中 main 清理已合併，已發布 npm 1.2.1 未重新打包，仍帶有 48 個 retired outputs。不能說目前 npm 安裝已沒有舊檔。
- 實際使用者的下游服務、登入、IDE runtime、自訂 consumer 與 ignored 本機框架未驗證。

## Module Lessons
- L01: 【歷史觀察／重驗線索，非本次環境驗證】ESLint MCP 掃描 TypeScript 需要目標專案自備 `eslint.config.*` + TypeScript parser
- L02: 【歷史觀察／重驗線索，非本次環境驗證】不同專案的 ESLint 外掛版本可能與 ESLint MCP 版本不相容（Bartender Map 的 react/display-name）
- L03: 【歷史觀察／重驗線索，非本次環境驗證】Gateway 掃描 8+ 個 MCP 時，遠端伺服器可能超時但不影響本地 MCP 註冊
- L04: 【歷史觀察／重驗線索，非本次環境驗證】npx 首次下載新套件時掃描易超時（registry 記錄 0 工具），需先手動 `npx -y <pkg> --help` 預下載後再 rescan
- L05: 【歷史觀察／重驗線索，非本次環境驗證】社群維護的 A11y MCP（@mseep/a11y-mcp、accessibility-mcp）在 Gateway 掃描時回傳 0 工具，可能是 MCP 協議實作不完整或初始化逾時
- L06: 依賴修補不可由「dev-only」推論零風險或一律安全自動修好。1.2.1 只在現有宣告範圍更新相容鎖檔；Vitest/esbuild 等不相容升級仍未做，完整 advisory、授權與迴歸需分別核對
- L07: 【歷史觀察／重驗線索，非本次環境驗證】記憶卡夾系統停用時，記憶卡需手動更新；恢復後應優先重啟並同步過期索引
- L08: 【歷史觀察／重驗線索，非本次環境驗證】Trunk MCP 使用 HTTP 傳輸，Gemini IDE `mcp_config.json` 需用 `serverURL` 欄位（非 `httpUrl`）；`httpUrl` 是 `.gemini/settings.json` 格式，兩者欄位名稱不同
- L09: 停用 MCP 時不要讓記憶卡繼續追蹤不存在的 `.json` 路徑；應改追蹤實際保留的 `.disabled` 檔，避免 ghost file 阻塞提交前檢查
- L10: 修改 Gateway 工具描述後，必須同時驗證 `src/` 測試與實際 `dist/` runtime；`tool_search` 顯示舊描述通常代表 MCP 連線仍在使用舊編譯品或舊 metadata 快取
- L11: 已連線的 Codex/Gemini MCP process 不會因 `npm run build` 自動熱更新；新 runtime 行為可由 `verify:runtime` 驗證，但目前 IDE 連線仍需重啟後才會看到新 Gateway 訊息
- L12: npm package 化後，公開可複製命令也是產品面；README 需同時提供 MCP client JSON、VS Code extension 安裝、`--scan`、`MULTI_MCP_HOME` 與發布 dry-run 驗證方式
- L13: Windows 本機 tarball smoke 應使用 `npx -y --package <tgz> -- multi-mcp-gateway ...` 驗證 bin；直接 `npx -y <tgz>` 可能 exit 0 但未穩定啟動 package bin
- L14: MCP SDK minor 升級不一定刷新間接依賴；安全修補應確認 lockfile 的實際解析、advisory 和迴歸結果。歷史上使用相容範圍的 audit fix 不代表每次都可自動修好，也不授權 force 或不相容升級
- L15: cartridge-system 5.2.0 起可直接作為 npm MCP runtime；在 Multi-MCP Gateway 內應避免下游設定固定 `--workspace`，由每次 `gateway__call_tool.workspace` 決定目標專案
- L16: 預設 MCP 不應透過 npm package 打包整個 `mcps/`，而應由初始化流程在 user-data 產生；這能避免私人路徑、金鑰佔位與 disabled 設定被公開發布
- L17: 【歷史觀察／重驗線索，非本次環境驗證】`gitnexus@latest` 在 Windows npx smoke 中可能觸發 npm exec 錯誤；預設 seed 應使用已驗證的 explicit `--package gitnexus@1.6.5 -- gitnexus mcp` 形式，等 latest 修復後再放寬
- L18: Gateway 若本身由 `npx --package <tgz>` 啟動，下游 `npx -y <pkg>@latest` 可能被 cmd 拆成錯誤指令；預設 seed 與 smoke 測試需使用 explicit package 形態驗證
- L19: `.gitignore` 重排時要用 `git check-ignore -v` 驗證關鍵檔案，避免註解整理意外改變 `.agents/memory/` 放行或認證檔忽略行為
- L20: 【歷史觀察／重驗線索，非本次環境驗證】VS Code extension test 在此 Windows 環境需清掉 `ELECTRON_RUN_AS_NODE`，否則下載的 Code.exe 會以 Node 模式解析 VS Code 啟動參數並失敗。

## Relations
- gateway-core
- cli
- management-api
- vscode-extension

## Archive Index
改寫前完整卡、原 D/L 編號及當時措辭保留於 [此卡的不可變歷史版本](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/.agents/memory/_system/SKILL.md)。本次沒有刪除 Git 歷史。下列過期／衝突／未驗證分類描述本次證據狀態，不是取消歷史事件或創設新授權。

## Current Release and Validation Boundary
- main source：Gateway package/lock 1.2.1、extension package/lock 0.1.5；清理 PR #3 已合併但 CHANGELOG 明列「尚未發布」。
- npm 1.2.1 的正式發布與清理是不同事件：PR #3 的已裁定封裝對照記錄其 156 files 和 48 retired outputs；新來源乾淨包才是 108 files。本次不發布、不改版本，也不將新包測試當成 npm 現況。
- extension 0.1.5 已有 GitHub Release，VSIX 198,900 bytes，SHA-256 `8f3b9cf34ef847093b79fb217f078512e632761d1a8e580e389e11096b4adb57`；extension 內含 core 1.2.1，不替換另一個執行中的 Gateway。
- 既有 PR CI 同一來源 tree 的 Linux/Windows 各通過 249 core、64 extension tests、build、hermetic runtime、VSIX 與 VS Code smoke；production audit / installed tarball checks 為 Linux-only。merge SHA 沒有新 checks，因 workflow 沒有 push trigger。這是既有程式驗證；本次 Memory PR 需另驗它自己的最終 commit。
- 發布流程分開：Gateway npm 是 workflow_dispatch + exact main/version + OIDC；VSIX 是 tag workflow。一般 PR checks 不發布。

## Evidence Base
- [package.json](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/package.json)
- [.npmrc](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/.npmrc)
- [src/paths.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/paths.ts)
- [scripts/verify-gateway-runtime.mjs](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/scripts/verify-gateway-runtime.mjs)
- [scripts/verify-release-tarball.mjs](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/scripts/verify-release-tarball.mjs)
- [CHANGELOG.md](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/CHANGELOG.md)
- [.github/workflows/pull-request-checks.yml](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/.github/workflows/pull-request-checks.yml)
- [.github/workflows/gateway-npm-release.yml](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/.github/workflows/gateway-npm-release.yml)
- [.github/workflows/vscode-extension-release.yml](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/.github/workflows/vscode-extension-release.yml)
- [清理與既有同 tree CI 證據](https://github.com/Kunshao1117/Multi-MCP/pull/3)
- [已發布 extension 0.1.5](https://github.com/Kunshao1117/Multi-MCP/releases/tag/vscode-multi-mcp-manager-v0.1.5)

## Conflicts and Supersession
有效：user-data/package root 分離、seed marker/disabled 意圖、npm 白名單、management subpath、VSIX 不追蹤、公開 catalog 與 extension Catalog UI 分離。衝突已更正：`.npmrc` 固定 cmd、第三方 12 工具 runtime、Git ignore 等同 credential 安全、dev advisory 可一概安全自動修好。過期：1.0.0/1.1.x 發布門檻不代表 1.2.1 狀態；固定 Windows 主機與絕對 IDE 路徑不可當產品預設。未驗證：舊 Snyk/Supabase/Trunk/IDE session 與外部 MCP 失敗觀察；保留為歷史線索，不宣稱現行故障。原 D16 第二項改標 D16b，避免兩個決策共用編號。
