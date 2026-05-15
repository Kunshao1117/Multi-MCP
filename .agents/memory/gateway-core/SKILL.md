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
last_updated: '2026-05-15T17:01:37+08:00'
status: stable
staleness: 0
---

# Gateway Core — Module Memory

## Tracked Files
- src/index.ts
- src/types.ts
- src/logger.ts
- src/config-loader.ts
- src/credential-store.ts
- src/gateway-tools.ts
- src/gateway-server.ts
- src/process-pool.ts
- src/tool-router.ts
- src/auth-guides.ts
- src/registry.ts
- src/registry.test.ts
- src/config-loader.test.ts
- src/tool-router.test.ts
- src/process-pool.test.ts

## Key Decisions
- D01: 閘道器只暴露管理工具（10 個），下游工具透過 search_tools + call_tool 動態發現
- D02: 程序池採懶啟動 + 閒置回收 + 指數退避重試，確保資源效率
- D03: 認證失敗時優雅降級，回傳操作指引而非原始錯誤碼
- D04: config-loader 先注入 gateway.env 到 process.env，再解析 ${VAR} 模板
- D05: Registry 搜尋引擎使用加權評分（名稱×3、命名空間×2、描述×1）
- D06: 測試策略採行為驅動——透過 vi.mock 模擬檔案系統和 MCP SDK，零原始碼修改
- D07: call_tool 轉發前根據集成表 inputSchema 自動強轉參數型別（string→number、string→boolean），容錯不同 AI 模型/IDE 的型別推斷差異
- D08: 新增 gateway__set_workspace / gateway__get_workspace 工具，讓 AI 明確宣告目標專案目錄；MCP SDK callTool 不支援 env 注入，workspace 路徑以 ToolRouter 內部狀態儲存，不自動注入下游工具環境變數
- D09: Gateway 啟動時在 process.chdir() 之前偵測 INIT_CWD / VSCODE_CWD / WORKSPACE_ROOT 環境變數；CLI --workspace= 參數優先於環境變數；偵測結果透過三層建構子縷淯層層傳遞至 ToolRouter
- D10: gateway__call_tool 的 workspace 改為必填參數，AI 必須在每次呼叫時宣告目標專案目錄；workspace 對本次呼叫暫時生效，finallyblock 確保全局狀態不被污染
- D11: call_tool 轉發前以 `.agents` 目錄存在性驗證 projectRoot——AI 填錯則自動修正為 effectiveWorkspace，未填則自動注入；使用 fs.existsSync 同步檢查，開銷極小
- D12: Gateway 管理工具 metadata 集中於 `src/gateway-tools.ts`，`GatewayServer` 的 tools/list 與 `ToolRouter` 搜尋提示共用同一份描述，避免 call 入口描述與搜尋結果不同步
- D13: `gateway__search_tools` 現在會把 Gateway 管理工具納入搜尋；查詢 call tool、呼叫工具、Gateway 呼叫或下游工具名稱時，優先露出 `gateway__call_tool`
- D14: `gateway__list_server_tools` 回傳下游工具 inputSchema 並用實際 tools map 計算數量，避免 registry `tool_count` 快取過期造成分類摘要或工具數量錯誤
- D15: `gateway__call_tool` 錯誤訊息需區分 server 未註冊、工具不存在、Gateway 管理工具誤用與下游 schema/呼叫失敗，並提醒 AI 先查 inputSchema 不猜參數

## Known Issues
- credentials.json 明文儲存密鑰，雖被 .gitignore 排除但缺少加密層
- （已解決）cli.ts 原 888 行超閾值——已完成拆分為 6 個子模組

## Module Lessons
- L01: vi.fn 泛型語法 vi.fn<[], T>() 在 TypeScript 5.7+vitest 3.0 下報 TS2558，需改為無泛型呼叫
- L02: 模擬 MCP SDK 需用 vi.hoisted 宣告 mock 函式，確保 vi.mock 工廠可引用外部變數
- L03: 不同 AI 模型/IDE 可能將數字參數傳為字串，下游 MCP 的 Zod 驗證器會拒絕；閘道器應在轉發前根據 schema 容錯強轉
- L04: MCP SDK Client.callTool() 僅接受 name 與 arguments，不支援 env 欄位；工作目錄注入需透過其他機制（如 process-pool spawn cwd）實現，本次採狀態儲存方案
- L05: IDE 啟動子程序時原始 cwd 儲存於 INIT_CWD 環境變數（npm/npx 標準）；必須在 process.chdir() 覆蓋之前擷取，否則變數仍存在但已失去參考意義
- L06: INIT_CWD 偵測到的是 IDE 自身安裝目錄而非使用者專案；環境變數對於跨專案共用的 Gateway 不可靠
- L07: projectRoot 路徑驗證使用 `!('projectRoot' in toolArgs)` 而非 `!toolArgs.projectRoot`，區分「AI 刻意傳了空值」與「AI 完全沒傳」，只在後者才注入
- L08: set_workspace case 中 `const path = args.path` 會遮蔽頂部 `import path from 'node:path'`，需重命名為 `wsPath` 避免影響同檔案其他 case 的 path 引用
- L09: Gateway 工具提示是 AI 行為控制面的一部分；搜尋工具若只回傳下游結果但不露出 `gateway__call_tool`，AI 可能誤判只能瀏覽不能真實呼叫
- L10: 下游 MCP 工具參數必須以 registry inputSchema 為準；例如 cartridge-system 的 `memory_deps` 使用 `moduleName`，不是模型猜測的 `module`
