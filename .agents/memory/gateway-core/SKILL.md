---
name: gateway-core
description: >
  專案記憶：Gateway 核心模組（設定載入、程序池、路由引擎、集成表、日誌、認證指南）。 Use when:
  修改閘道器核心邏輯、程序管理、工具路由、掃描機制 的任務。
metadata:
  author: antigravity
  version: '1.0'
  origin: memory-arch
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
    - 'mcp:cartridge-system'
last_updated: '2026-05-18T21:37:29+08:00'
status: stable
staleness: 0
---

# Gateway Core — Module Memory

## Tracked Files
- src/index.ts
- src/paths.ts
- src/paths.test.ts
- src/runtime-guard.ts
- src/runtime-guard.test.ts
- src/types.ts
- src/logger.ts
- src/config-loader.ts
- src/credential-store.ts
- src/gateway-tools.ts
- src/gateway-server.ts
- src/process-pool.ts
- src/subprocess-env.ts
- src/subprocess-env.test.ts
- src/tool-router.ts
- src/auth-guides.ts
- src/registry.ts
- src/registry.test.ts
- src/config-loader.test.ts
- src/tool-router.test.ts
- src/process-pool.test.ts
- scripts/verify-gateway-runtime.mjs

## Key Decisions
- D01: 閘道器只暴露管理工具（10 個），下游工具透過 search_tools + call_tool 動態發現
- D02: 程序池採懶啟動 + 閒置回收 + 指數退避重試，確保資源效率
- D03: 認證失敗時優雅降級，回傳操作指引而非原始錯誤碼
- D04: config-loader 先注入 gateway.env 到 process.env，再解析 ${VAR} 模板
- D05: Registry 搜尋引擎使用加權評分（名稱×3、命名空間×2、描述×1）
- D06: 測試策略採行為驅動——透過 vi.mock 模擬檔案系統和 MCP SDK，零原始碼修改
- D07: call_tool 轉發前根據集成表 inputSchema 自動強轉參數型別（string→number、string→boolean），容錯不同 AI 模型/IDE 的型別推斷差異
- D08: 1.1.0 起移除 gateway__set_workspace / gateway__get_workspace，Gateway 不再保存固定全域 workspace，避免多專案共用同一 process 時路徑互相污染
- D09: Gateway 不再自動套用 INIT_CWD / VSCODE_CWD / WORKSPACE_ROOT 或 --workspace 作為預設專案目錄；--workspace 僅輸出停用提醒，不影響下游工具呼叫
- D10: gateway__call_tool 的 workspace 為必填參數，也是每次呼叫的唯一可信專案來源；projectRoot 注入與修正只依本次 workspace 執行，不保存跨呼叫狀態
- D11: call_tool 轉發前以 `.agents` 目錄存在性驗證 projectRoot——AI 填錯則自動修正為 effectiveWorkspace，未填則自動注入；使用 fs.existsSync 同步檢查，開銷極小
- D12: Gateway 管理工具 metadata 集中於 `src/gateway-tools.ts`，`GatewayServer` 的 tools/list 與 `ToolRouter` 搜尋提示共用同一份描述，避免 call 入口描述與搜尋結果不同步
- D13: `gateway__search_tools` 現在會把 Gateway 管理工具納入搜尋；查詢 call tool、呼叫工具、Gateway 呼叫或下游工具名稱時，優先露出 `gateway__call_tool`
- D14: `gateway__list_server_tools` 回傳下游工具 inputSchema 並用實際 tools map 計算數量，避免 registry `tool_count` 快取過期造成分類摘要或工具數量錯誤
- D15: `gateway__call_tool` 錯誤訊息需區分 server 未註冊、工具不存在、Gateway 管理工具誤用與下游 schema/呼叫失敗，並提醒 AI 先查 inputSchema 不猜參數
- D16: `dist/index.js` 啟動 Gateway 時會執行 runtime freshness guard；若偵測到非測試 `src/**/*.ts` 比 `dist/**/*.js` 新，直接拒絕啟動並提示先 `npx tsc` 後重啟 MCP 連線
- D17: 下游工具參數錯誤提示只根據 registry inputSchema 產生；Gateway 可提示未知參數、缺少 required 與高相似度參數名稱，但不自動改寫 arguments 或重試
- D18: `src/paths.ts` 集中解析 package root 與使用者資料 root；預設資料夾依平台決定，`MULTI_MCP_HOME` 可覆寫
- D19: `src/index.ts` 是 npm bin 入口，含 shebang，支援 `console` 子命令與 `--scan`，啟動前會建立使用者資料夾並切換到 data dir
- D20: `config-loader` 將 `gateway.env` 與 `mcps_dir` 相對路徑改以設定檔所在資料夾解析，避免 npm package 安裝位置污染使用者設定
- D21: `registry` 的 load/scan 支援自訂 registry path，寫入前會建立目標資料夾；CLI 與 server 可共用使用者資料夾內的 registry
- D22: `ensureUserDataDir()` 會在沒有 `default-mcps.seed.json` 時一次性建立可攜、無金鑰的預設 MCP 設定；marker 存在後不再補回被刪除的預設 MCP
- D23: 預設 seed 寫入前會掃描所有分類，若同名 `.json`、`.disabled` 或 `.json.disabled` 已存在則跳過，避免覆蓋使用者自訂或停用意圖
- D24: 預設 seed 全部使用 explicit package 形式 `npx -y --package <pkg> -- <bin>`；這是 tarball smoke 驗證後的 Windows nested npx 相容策略
- D25: `registry` 掃描與 `ProcessPool` runtime 啟動下游 MCP 時，統一透過 `createDownstreamEnv()` 清掉外層 npm lifecycle 變數並保留 MCP 認證 env

## Known Issues
- credentials.json 明文儲存密鑰，雖被 .gitignore 排除但缺少加密層
- （已解決）cli.ts 原 888 行超閾值——已完成拆分為 6 個子模組

## Module Lessons
- L01: vi.fn 泛型語法 vi.fn<[], T>() 在 TypeScript 5.7+vitest 3.0 下報 TS2558，需改為無泛型呼叫
- L02: 模擬 MCP SDK 需用 vi.hoisted 宣告 mock 函式，確保 vi.mock 工廠可引用外部變數
- L03: 不同 AI 模型/IDE 可能將數字參數傳為字串，下游 MCP 的 Zod 驗證器會拒絕；閘道器應在轉發前根據 schema 容錯強轉
- L04: MCP SDK Client.callTool() 僅接受 name 與 arguments，不支援 env 欄位；專案工作目錄不得依賴隱式 process cwd，必須由 Gateway 工具 schema 明確傳入
- L05: IDE / npx 注入的 INIT_CWD、VSCODE_CWD、WORKSPACE_ROOT 可能是 IDE 安裝目錄、套件快取或上一個專案；只能作為診斷線索，不可默默套用為下游工具 workspace
- L06: 跨專案安全優先於省略參數；AI 可在對話中記住使用者確認的路徑，但每次 gateway__call_tool 仍必須明確傳入 workspace
- L07: projectRoot 路徑驗證使用 `!('projectRoot' in toolArgs)` 而非 `!toolArgs.projectRoot`，區分「AI 刻意傳了空值」與「AI 完全沒傳」，只在後者才注入
- L08: 固定 workspace 管理工具已移除；若未來新增 workspace 候選偵測，必須只回傳候選並由 AI 詢問操作者確認，不能在 Gateway process 內保存全域預設
- L09: Gateway 工具提示是 AI 行為控制面的一部分；搜尋工具若只回傳下游結果但不露出 `gateway__call_tool`，AI 可能誤判只能瀏覽不能真實呼叫
- L10: 下游 MCP 工具參數必須以 registry inputSchema 為準；例如 cartridge-system 的 `memory_deps` 使用 `moduleName`，不是模型猜測的 `module`
- L11: `dist/` 被 `.gitignore` 排除但仍是 Codex/Gemini runtime，不能只靠記憶或文件要求 AI build；啟動期 guard 才能防止舊工具 metadata 靜默上線
- L12: 參數名稱友善提示必須採保守相似度規則；找不到高信心匹配時只列 schema 接受的 arguments，避免把 AI 導向錯誤參數
- L13: npm package 化後，Gateway 核心不得假設目前工作目錄就是 repo root；所有使用者設定路徑都必須從 `src/paths.ts` 或 config file directory 取得
- L14: user-data default seed 必須有狀態檔，否則使用者刪除預設 MCP 後會被下次啟動重新建立，造成「可刪除」語義失效
- L15: default seed 中的 npm CLI 若使用 `npx -y <pkg>@latest` 形式在 tarball smoke 失敗，應採 `npx --package <pkg>@<verified-or-latest> -- <bin>` 並用 MCP client smoke 驗證
- L16: 下游 stdio 程序不能完整繼承外層 npm/npx runtime env；至少要清掉 `npm_lifecycle_*`、`npm_package_*`、`npm_execpath` 等變數，避免 Windows 內層 npx 解析錯亂
