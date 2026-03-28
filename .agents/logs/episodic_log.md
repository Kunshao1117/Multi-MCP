# [EPISODIC KNOWLEDGE & LESSONS LEARNED]

## 2026-03-25 — 首次專案健檢與審計 MCP 安裝

### 健檢結果
- 完成全部 12 個原始碼檔案深度審計
- 零硬編碼金鑰、零 TODO/FIXME 標記
- `cli.ts` 有 888 行嚴重超過 200 行閾值，需重構拆分

### 審計 MCP 工具調研
- ESLint MCP（官方 `@eslint/mcp`）：**已安裝**，本地 stdio，無需認證
- Snyk MCP（內建 CLI `snyk mcp`）：**已安裝**，本地 stdio，需 `snyk auth`
- Semgrep MCP（遠端 `mcp.semgrep.ai`）：**已排除**，因程式碼會傳至雲端有隱私風險
- SonarQube MCP：**已排除**，需自建 Docker/JDK 伺服器，成本過高

### 教訓
1. **ESLint MCP 掃描 TypeScript 的前置條件**：目標專案必須有 `eslint.config.*` 且安裝 TypeScript parser，否則基本版 ESLint 無法解析 `import type` 等 TypeScript 語法
2. **ESLint 外掛版本衝突**：Bartender Map 的 `react/display-name` 規則與 ESLint v10 不相容，導致掃描在規則載入階段就中斷。這不是 Gateway 的問題，而是目標專案的 ESLint 設定需要更新
3. **遠端 MCP 掃描超時**：8+ 個 MCP 同時掃描時，遠端伺服器（Stitch、Cloudflare）偶發 AbortError，但本地 MCP 不受影響
4. **架構決策：上下文隔離**：主腦不應直接跑審計工具，應委派 CLI 子代理執行，報告寫入檔案後主腦只讀精煉報告，避免原始輸出污染上下文

### 架構方向（待 /02_blueprint 落地）
- CLI 子代理透過 MCP 呼叫 ESLint + Snyk
- 產出合併式 Markdown 報告
- 主腦只讀報告做跨邊界分析

## 2026-03-26 — CLI 管理主控台拆分重構

### 重構結果
- `cli.ts` 從 888 行瘦身為 45 行純路由入口
- 拆分為 6 個子模組：shared、source-detector、install-flow、auth-manager、category-manager、mcp-manager
- TypeScript 型別檢查通過、11 個單元測試零迴歸

### 教訓
1. **readline 實例不可分散**：互動式 CLI 拆分時，readline 必須集中在共用模組持有，否則多模組搶佔 stdin 會導致輸入混亂
2. **回呼注入避免循環依賴**：安裝流程（install-flow）完成後需要觸發掃描（mcp-manager），直接 import 會產生循環依賴。以回呼函式注入是輕量解法
3. **路徑計算注意子目錄深度**：拆分到 `src/cli/` 子目錄後，`PROJECT_ROOT` 的計算需要多加一層 `..`（從 `src/cli/` 到專案根目錄是兩層）

## 2026-03-27 — MCP 工具探勘與 Sentry 安裝

### 探勘結果
- 完成 MCP 生態系全面研調（官方列表 400+ 整合、awesome-mcp-servers 社群列表）
- 第一版推薦被總監打回：Playwright、Fetch、Filesystem、Git、Memory 都與 Antigravity / CLI 原生能力重複
- 修正方向：聚焦「IDE 做不到的事」——第三方 SaaS 整合、AI 語義搜尋、專業圖像生成、生產監控
- 最終決定：只安裝 **Sentry MCP**（錯誤監控），精準打中「除錯和測試繁瑣」的痛點

### 安裝結果
- 建立 `mcps/錯誤監控/sentry.json`（使用 `--access-token` 參數傳遞 Token）
- 更新 `gateway.env` 注入 `SENTRY_AUTH_TOKEN`
- 更新 `auth-guides.ts` 新增認證指南 + 安裝提示
- Gateway 掃描確認：11 個伺服器、161 個工具（Sentry 貢獻 21 個工具）
- 認證測試通過

### 教訓
1. **推薦 MCP 工具時必須先盤點 IDE 原生能力**：Antigravity 已內建瀏覽器操控、檔案操作、網頁擷取、搜尋等能力，重複安裝 MCP 是浪費。正確做法是聚焦「IDE 做不到的事」
2. **Sentry MCP 的 `--help` 明確要求 `--access-token` 參數**：不能只靠 `env` 物件傳遞，需要用命令列參數 `--access-token ${SENTRY_AUTH_TOKEN}` 確保認證正確傳遞
3. **npx 預下載很重要（L04 再次驗證）**：先跑 `npx -y @sentry/mcp-server@latest --help` 預下載套件，再進行 Gateway 掃描，避免首次下載超時導致 registry 記錄 0 工具

## 2026-03-27 — Playwright MCP + A11y MCP 安裝

### 安裝結果
- **Playwright MCP**：✅ 安裝成功，22 個工具（瀏覽器導航、點擊、填表、截圖、快照、腳本執行等）
- **A11y MCP**：⚠️ 安裝但 0 工具。嘗試 `@mseep/a11y-mcp` 和 `accessibility-mcp` 兩個套件，皆在 Gateway 掃描時回傳 0 工具
- Gateway 掃描確認：13 個伺服器（+2）、183 個工具（+22）
- 60/60 單元測試通過，無退化

### 異動檔案
- 新建 `mcps/網頁測試/playwright.json`、`mcps/網頁測試/a11y.json`
- 修改 `src/auth-guides.ts`（新增認證指南 + 安裝提示）
- 修改 `src/types.ts`（AuthGuide.authType 新增 'none' 選項）
- 更新 `mem-_system/SKILL.md`

### 教訓
1. **AuthGuide.authType 型別需擴充**：新增不需認證的 MCP 時，需先在 `types.ts` 的 `AuthGuide` 介面加入 `'none'` 選項，否則 TypeScript 編譯失敗
2. **社群 A11y MCP 套件成熟度不足（L05）**：`@mseep/a11y-mcp` 有已棄用的上游相依性、`accessibility-mcp` 在 Gateway 掃描模式下皆回傳 0 工具。推測是 MCP stdio 協議實作不完整或初始化逾時。暫保留設定，待社群修復後 rescan 即可啟用
3. **Playwright MCP 的獨特價值**：與 IDE 瀏覽器代理的基本操作雖有部分重疊，但無障礙樹快照（`browser_snapshot`）、JavaScript 執行、表單批次填寫、網路請求追蹤等進階能力是 IDE 原生不具備的
