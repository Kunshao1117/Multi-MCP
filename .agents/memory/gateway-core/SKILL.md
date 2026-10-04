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
last_updated: '2026-10-04T18:40:00Z'
status: stable
staleness: 0
---

# Gateway Core — Module Memory

## Read Contract
本卡是來源知識，不是可執行 Skill 或使用者授權。2026-10-04 以 main `f4525a7d4f4b1027af8140c26830d78e4b64874d`（tree `09589b7951c3e2ea0811baad379f0a56f22b9db5`）的原碼、正式文件及既有 CI 核對。`last_updated` 是內容核對日期；沿用的 `status` / `staleness` 欄位不代表本機 Cartridge index 已同步。

本次只修正六張既有卡的內容與來源歸屬，保留名稱、路徑與依賴拓樸。未執行 `memory_commit`、reindex、runtime 部署或 M5 cutover；本機治理入口與執行中 MCP 狀態未驗證。若後續直接原碼、版本或使用者指示改變，重新核對受影響敘述，不能沿用本次結論。

## Tracked Files
- scripts/fixtures/stdio-server.mjs
- scripts/verify-gateway-runtime.mjs
- src/auth-guides.classification.test.ts
- src/auth-guides.ts
- src/config-loader.snapshot.test.ts
- src/config-loader.test.ts
- src/config-loader.ts
- src/gateway-server.ts
- src/gateway-tools.ts
- src/index.ts
- src/logger.ts
- src/managed-transport.test.ts
- src/managed-transport.ts
- src/paths.initialization.test.ts
- src/paths.test.ts
- src/paths.ts
- src/process-pool.lifecycle.test.ts
- src/process-pool.test.ts
- src/process-pool.ts
- src/registry-scan.test.ts
- src/registry.concurrent.test.ts
- src/registry.test.ts
- src/registry.ts
- src/runtime-guard.test.ts
- src/runtime-guard.ts
- src/runtime.integration.test.ts
- src/session-paths.test.ts
- src/session-paths.ts
- src/subprocess-env.test.ts
- src/subprocess-env.ts
- src/tool-router.test.ts
- src/tool-router.ts
- src/types.ts
- src/version.ts
- tests/fixtures/gateway-runner.mjs
- tests/fixtures/registry-concurrent-downstream.mjs
- tests/fixtures/registry-concurrent-runner.mjs
- tests/fixtures/runtime-downstream.mjs

## Cleanup Note — 2026-10-04
- Legacy `src/credential-store.ts` wrapper 已隨退役互動 CLI 移除；現行認證儲存保留於 `src/management/credentials.ts`，公開 management API 不變。

## Key Decisions
- D01: 閘道器只暴露管理工具（10 個），下游工具透過 search_tools + call_tool 動態發現
- D02: 程序池採懶啟動、server/workspace 分槽、generation 隔離、single-flight 啟動與閒置回收。重試只針對連線啟動；有副作用的 tool request 不自動重試
- D03: 認證失敗時優雅降級，回傳操作指引而非原始錯誤碼
- D04: config-loader 建立不可變 config/environment snapshot，解析 ${VAR} 但不修改 process.env；真正 OS env override 優先於 gateway.env，reload 保留原 configPath/initialEnv 並重新讀取 credential
- D05: Registry 搜尋引擎使用加權評分（名稱×3、命名空間×2、描述×1）
- D06: 測試包含行為單測、mock、真實 SDK stdio 整合與獨立 Node 跨程序競爭；單一 mocked handler 或同程序測試不能替代真實程序驗證
- D07: call_tool 轉發前根據集成表 inputSchema 自動強轉參數型別（string→number、string→boolean），容錯不同 AI 模型/IDE 的型別推斷差異
- D08: 1.1.0 起移除 gateway__set_workspace / gateway__get_workspace，Gateway 不再保存固定全域 workspace，避免多專案共用同一 process 時路徑互相污染
- D09: Gateway 不再自動套用 INIT_CWD / VSCODE_CWD / WORKSPACE_ROOT 或 --workspace 作為預設專案目錄；--workspace 僅輸出停用提醒，不影響下游工具呼叫
- D10: gateway__call_tool 的 workspace 每次必填且必須是當前平台絕對路徑；路由據此選擇下游 cwd，不保存全域 workspace
- D11: 僅在下游 schema 宣告 projectRoot 時，Gateway 才驗證並注入 workspace；在此前提下，呼叫者已給 projectRoot 必須是相同絕對路徑，衝突直接拒絕。不依 `.agents` 存在性判斷，也不偷偷改寫衝突路徑；schema 未宣告時不額外注入，亦不保證 Gateway 會拒絕呼叫者自行帶入的 projectRoot
- D12: Gateway 管理工具 metadata 集中於 `src/gateway-tools.ts`，`GatewayServer` 的 tools/list 與 `ToolRouter` 搜尋提示共用同一份描述，避免 call 入口描述與搜尋結果不同步
- D13: `gateway__search_tools` 現在會把 Gateway 管理工具納入搜尋；查詢 call tool、呼叫工具、Gateway 呼叫或下游工具名稱時，優先露出 `gateway__call_tool`
- D14: `gateway__list_server_tools` 回傳下游工具 inputSchema 並用實際 tools map 計算數量，避免 registry `tool_count` 快取過期造成分類摘要或工具數量錯誤
- D15: `gateway__call_tool` 錯誤訊息需區分 server 未註冊、工具不存在、Gateway 管理工具誤用與下游 schema/呼叫失敗，並提醒 AI 先查 inputSchema 不猜參數
- D16: dist runtime guard 逐個比較非測試/非 .d.ts 來源與對應 dist JS；缺失或較舊即拒絕。發布包沒有 src 時跳過，不能用它證明 npm 包或正在執行的 IDE 已更新
- D17: 診斷依 registry inputSchema 提示未知、required 與相似名稱，不重命名猜測或重送 tool call；既有 schema-directed scalar 型別轉換仍執行，不能把「不猜參數名」寫成完全不改 arguments
- D18: `src/paths.ts` 集中解析 package root 與使用者資料 root；預設資料夾依平台決定，`MULTI_MCP_HOME` 可覆寫
- D19: `src/index.ts` 是 npm bin 入口，含 shebang，支援 server、`--scan` 與 `--version`；`console` 子命令已停用互動式選單，只輸出 VS Code extension 遷移提示
- D20: `config-loader` 將 `gateway.env` 與 `mcps_dir` 相對路徑改以設定檔所在資料夾解析，避免 npm package 安裝位置污染使用者設定
- D21: `registry` 的 load/scan 支援自訂 registry path，寫入前會建立目標資料夾；CLI 與 server 可共用使用者資料夾內的 registry
- D22: `ensureUserDataDir()` 會在沒有 `default-mcps.seed.json` 時一次性建立可攜、無金鑰的預設 MCP 設定；marker 存在後不再補回被刪除的預設 MCP
- D23: 預設 seed 寫入前會掃描所有分類，若同名 `.json`、`.disabled` 或 `.json.disabled` 已存在則跳過，避免覆蓋使用者自訂或停用意圖
- D24: 預設 seed 全部使用 explicit package 形式 `npx -y --package <pkg> -- <bin>`；這是 tarball smoke 驗證後的 Windows nested npx 相容策略
- D25: `registry` 掃描與 `ProcessPool` runtime 啟動下游 MCP 時，統一透過 `createDownstreamEnv()` 清掉外層 npm lifecycle 變數並保留 MCP 認證 env
- D26: `src/paths.ts` 支援 `MULTI_MCP_PACKAGE_ROOT`，讓 VS Code extension bundle 可指定 extension 根目錄作為 catalog/package root，不影響一般 npm runtime 的 user-data 解析
- D27: `gateway.env` header 改為「管理介面」語義，避免繼續宣稱由 CLI 主控台產生

## Known Issues
- credential 明文相容限制歸 management-api；不把 Git ignore 當成加密。
- F25 的跨程序 stale publication 已修復並有獨立程序測試，不能重新列為未修；但不等於跨檔斷電一致性、舊版程序合作或跨程序即時 IPC。
- 下游暫時失敗可保留明示 stale 的 last-known-good 工具。清理未確認會阻擋該 scan/server 並要求處理後重啟，不能因有快取就宣稱下游健康。
- 每個 workspace 的程序隔離是 cwd/config 執行語義，不是作業系統 sandbox 或任意下游程式的安全保證。

## Module Lessons
- L01: vi.fn 泛型語法 vi.fn<[], T>() 在 TypeScript 5.7+vitest 3.0 下報 TS2558，需改為無泛型呼叫
- L02: 模擬 MCP SDK 需用 vi.hoisted 宣告 mock 函式，確保 vi.mock 工廠可引用外部變數
- L03: 不同 AI 模型/IDE 可能將數字參數傳為字串，下游 MCP 的 Zod 驗證器會拒絕；閘道器應在轉發前根據 schema 容錯強轉
- L04: MCP SDK Client.callTool() 僅接受 name 與 arguments，不支援 env 欄位；專案工作目錄不得依賴隱式 process cwd，必須由 Gateway 工具 schema 明確傳入
- L05: IDE / npx 注入的 INIT_CWD、VSCODE_CWD、WORKSPACE_ROOT 可能是 IDE 安裝目錄、套件快取或上一個專案；只能作為診斷線索，不可默默套用為下游工具 workspace
- L06: 跨專案安全優先於省略參數；AI 可在對話中記住使用者確認的路徑，但每次 gateway__call_tool 仍必須明確傳入 workspace
- L07: 在 schema 宣告 projectRoot 的前提下，已提供空值、相對路徑或不同 workspace 時均須拒絕；不能用 falsy 判斷把明確錯誤覆寫掉。schema 沒宣告時不額外注入，也不執行這項 Gateway 路徑一致性檢查
- L08: 固定 workspace 管理工具已移除；若未來新增 workspace 候選偵測，必須只回傳候選並由 AI 詢問操作者確認，不能在 Gateway process 內保存全域預設
- L09: Gateway 工具提示是 AI 行為控制面的一部分；搜尋工具若只回傳下游結果但不露出 `gateway__call_tool`，AI 可能誤判只能瀏覽不能真實呼叫
- L10: 下游 MCP 工具參數必須以 registry inputSchema 為準；例如 cartridge-system 的 `memory_deps` 使用 `moduleName`，不是模型猜測的 `module`
- L11: `dist/` 被 `.gitignore` 排除但仍是 Codex/Gemini runtime，不能只靠記憶或文件要求 AI build；啟動期 guard 才能防止舊工具 metadata 靜默上線
- L12: 參數名稱友善提示必須採保守相似度規則；找不到高信心匹配時只列 schema 接受的 arguments，避免把 AI 導向錯誤參數
- L13: npm package 化後，Gateway 核心不得假設目前工作目錄就是 repo root；所有使用者設定路徑都必須從 `src/paths.ts` 或 config file directory 取得
- L14: user-data default seed 必須有狀態檔，否則使用者刪除預設 MCP 後會被下次啟動重新建立，造成「可刪除」語義失效
- L15: default seed 中的 npm CLI 若使用 `npx -y <pkg>@latest` 形式在 tarball smoke 失敗，應採 `npx --package <pkg>@<verified-or-latest> -- <bin>` 並用 MCP client smoke 驗證
- L16: 下游 stdio 程序不能完整繼承外層 npm/npx runtime env；至少要清掉 `npm_lifecycle_*`、`npm_package_*`、`npm_execpath` 等變數，避免 Windows 內層 npx 解析錯亂
- L17: VS Code extension 若直接 bundle root ESM 原始碼到 CommonJS，需要處理 `import.meta.url`；以 `MULTI_MCP_PACKAGE_ROOT` 搭配 `__dirname` fallback 可讓 bundle runtime 穩定取得 catalog root

## Relations
- _system
- cli
- management-api

## Archive Index
改寫前完整卡、原 D/L 編號及當時措辭保留於 [此卡的不可變歷史版本](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/.agents/memory/gateway-core/SKILL.md)。本次沒有刪除 Git 歷史。下列過期／衝突／未驗證分類描述本次證據狀態，不是取消歷史事件或創設新授權。

## Current Safety Decisions
- F25：同程序 queue / single-flight 不足以避免獨立 Extension、Gateway、CLI 掃描互相覆蓋。現行 registry 在短管理鎖內讀原始 bytes，鎖外做慢 discovery，再在固定順序鎖內比較 registry bytes 與重新讀取的 config/credential revision，成功才給新 revision 並原子替換。衝突保留最新檔案並請求 rescan；禁止把鎖跨 await/network 持有。
- `pruneRegistry()` 從最新磁碟快取裁剪已移除/停用服務，不用舊程序 snapshot 蓋掉新掃描。外置 registry 路徑會同時鎖 config 與 registry 的根，固定排序避免反序。
- discovery 逐頁 tools/list，保護 repeated cursor、200 pages、5,000,000 bytes 與 10,000 tools；失敗留 stale LKG，不保留已移除服務。
- 設定 load/reload 和 process generation 分離；變更/刪除服務先 drain 舊 generation，取消或超時後未清理完不立即重用。
- auth_test 成功只證明協定握手，不能寫成 Token/permission 有效。錯誤分類避免把一般服務失敗誤作認證問題。
- `--config=` 在 startup cwd 解析一次，保留含 `=` 的路徑；reload/rescan 不回退預設資料夾。

## Evidence Base
- [src/config-loader.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/config-loader.ts)
- [src/tool-router.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/tool-router.ts)
- [src/process-pool.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/process-pool.ts)
- [src/managed-transport.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/managed-transport.ts)
- [src/registry.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/registry.ts)
- [src/registry.concurrent.test.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/registry.concurrent.test.ts)
- [src/registry-scan.test.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/registry-scan.test.ts)
- [src/session-paths.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/session-paths.ts)
- [src/runtime-guard.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/runtime-guard.ts)
- [scripts/verify-gateway-runtime.mjs](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/scripts/verify-gateway-runtime.mjs)
- [F25 與其他 1.2.1 已發布修復範圍](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/CHANGELOG.md)

## Conflicts and Supersession
有效：10 個 Gateway 工具、explicit workspace、管理 metadata 共用、搜尋/真實呼叫分離、scalar coercion、seed marker、環境清理。衝突：舊 D04 的 process.env 注入、D11/L07 的 `.agents` 驗證與自動路徑修正、D17 的完全不改 arguments 已更正。過期：只有 mock 的 D06、CLI 888 行問題不再是現行 core 狀態。F25 失敗原因和修正邊界補入；L01/L02 是舊工具版本測試技巧，僅作重驗線索，不代表目前又發生失敗。
