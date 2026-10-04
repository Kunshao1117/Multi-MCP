---
name: management-api
description: >
  專案記憶：Multi-MCP Gateway headless 管理 API。Use when: 修改 MCP 安裝/移除/啟停/掃描/認證/版本檢查等
  UI 無關管理能力，或 extension 需要共用管理邏輯時。
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
scopePath: src/management
dependencies:
  - gateway-core
---

# Headless Management API — Module Memory

## Read Contract
本卡是來源知識，不是可執行 Skill 或使用者授權。2026-10-04 以 main `f4525a7d4f4b1027af8140c26830d78e4b64874d`（tree `09589b7951c3e2ea0811baad379f0a56f22b9db5`）的原碼、正式文件及既有 CI 核對。`last_updated` 是內容核對日期；沿用的 `status` / `staleness` 欄位不代表本機 Cartridge index 已同步。

本次只修正六張既有卡的內容與來源歸屬，保留名稱、路徑與依賴拓樸。未執行 `memory_commit`、reindex、runtime 部署或 M5 cutover；本機治理入口與執行中 MCP 狀態未驗證。若後續直接原碼、版本或使用者指示改變，重新核對受影響敘述，不能沿用本次結論。

## Tracked Files
- src/management/catalog.ts
- src/management/credentials.ts
- src/management/files.ts
- src/management/index.ts
- src/management/management.test.ts
- src/management/safety.test.ts
- src/management/servers.ts
- src/management/storage.ts
- src/management/types.ts
- src/management/versions.ts

## Key Decisions
- D01: `multi-mcp-gateway/management` 是 extension 與未來非 CLI UI 的唯一共用管理層；新增管理能力應先落在此 API，再由 UI 呼叫。
- D02: 狀態讀取必須保持 zero-touch：`getGatewayStatus()` 與 `listMcpServers()` 只讀 user-data，不建立資料夾、不 seed 預設 MCP。
- D03: 讀取與初始化分離；mutating API 先驗證輸入及既有資料，再視需要初始化。rescan 是會啟動下游與更新 registry 的動作，不能把它當唯讀刷新。
- D04: 管理 API 沿用 `gateway.env` / `credentials.json` 相容模型；`CredentialSummary.maskedValue` 只提供遮罩值，UI 不得顯示完整 secret。
- D05: `installMcp()` 支援三種來源：mcpServers JSON、遠端 URL（透過 `mcp-remote`）、npm/GitHub package；GitHub package 解析失敗時回退 repo 名稱。
- D06: 啟用/停用 MCP 以重新命名 `.json`、`.json.disabled` 或 `.disabled` 設定檔完成，不改動設定內容。
- D07: `rescanRegistry()` 重用 `loadConfig()` 與 `scanAndGenerateRegistry()`，掃描結果寫回 user-data 的 `registry.json`。
- D08: `checkVersions()` 只處理可辨識 npm package 的啟用 MCP；停用或 custom/remote MCP 回傳 `skip`，避免誤報更新。
- D09: 本卡依賴 `gateway-core`，因管理 API 直接消費 `paths`、`config-loader`、`registry`、`auth-guides` 與共用型別。退役互動式 CLI 已移除，catalog 仍由本 API 公開提供；`mcp-catalog.json` 由 `_system` 追蹤，extension 不顯示或打包內建 Catalog。
- D10: `listCatalogEntries()` 會優先讀取 package root 的 `mcp-catalog.json`，若使用者層 `MULTI_MCP_PACKAGE_ROOT` 指向已安裝 extension 而該處沒有 catalog，會回退讀取目前工作目錄的 `mcp-catalog.json`，確保 repo 開發測試不受外部 extension 環境污染。
- D11: `listMcpServers()` 會從 registry snapshot 提供每個 MCP 最多 5 筆工具摘要（名稱、原始名稱、描述），讓 UI 顯示工具內容但不直接讀 user-data 檔案。
- D12: `updateMcp()` 是編輯既有 MCP 的唯一 headless API；它負責更新設定檔、重新命名、搬移分類、保留啟用/停用副檔名，並可選擇重新掃描 Registry。
- D13: updateMcp 的設定移動/重新命名、credential key 搬移與可選 credential input 先組成同一檔案變更集，再在管理鎖內提交；不是先改 config 再獨立呼叫 renameCredentialInStore。後者仍是可用 helper，但不是 updateMcp 的交易流程。

## Known Issues
- `credentials.json` 仍為明文相容儲存；v1 extension 不導入 VS Code SecretStorage，以免破壞現有 Gateway runtime。
- `authStatus` 目前以認證摘要與 required env vars 推估，尚未實際啟動下游 MCP 做 token 有效性測試。
- `checkVersions()` 將可連線 npm registry 且取得 latest 視為 `latest` 狀態，尚未比較目前安裝版本或產生 upgrade plan。
- `createConfigFromSource()` 只替 bare npm package 加 `@latest`；explicit version/range/tag 原樣保留。它仍用直接 `npx -y <spec>`，不同於 seed 的 explicit --package/bin；未宣稱所有第三方 Windows nested npx 相容。

## Module Lessons
- L01: 管理層讀寫行為必須分離；extension 啟動時只讀狀態，否則打開 VS Code 面板就會改動使用者資料夾。
- L02: headless API 回傳應使用 `OperationResult` 與 typed summaries，讓 UI 呈現與核心檔案操作解耦。
- L03: 安裝/移除後若需要立即刷新工具數，呼叫端應明確選擇是否 rescan；自動掃描會啟動多個下游 MCP，成本與錯誤面都高於純檔案寫入。
- L04: secret 顯示必須在 API 層先遮罩，避免各 UI 各自處理而漏出完整 token。
- L05: 使用者層環境變數可能會從已安裝 VSIX 污染 repo 測試；管理 API 對 package-root-only 資源應提供保守 fallback，避免開發命令誤讀 extension 安裝目錄。
- L06: 工具摘要應在 management API 層整理，避免 extension Webview 碰 `registry.json` 或完整 input schema，降低密度與耦合。
- L07: 編輯 MCP 比安裝更需要避免靜默覆蓋；目標設定檔已存在時應回傳錯誤，讓 UI 顯示衝突而不是自動取代。

## Applicable Skills
- `security-sre`：修改 credential 寫入、遮罩或 log 行為時使用。
- `impact-test-strategy`：新增跨 Gateway core / extension 的管理能力時使用。
- `memory-ops`：更新此卡或修復 staleness 時使用。

## Relations
- _system
- _map
- gateway-core
- cli
- vscode-extension

## Archive Index
改寫前完整卡、原 D/L 編號及當時措辭保留於 [此卡的不可變歷史版本](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/.agents/memory/management-api/SKILL.md)。本次沒有刪除 Git 歷史。下列過期／衝突／未驗證分類描述本次證據狀態，不是取消歷史事件或創設新授權。

## Current Safety Decisions
- `storage.ts` 驗證安全單一路徑名稱、保留名稱、越界、dangling/ancestor symlink；createOnly 不可靜默覆蓋。損壞 JSON / credential 格式會保留原檔並停止，不視作空資料重寫。
- 管理鎖 `.management.lock` 用 wx 跨程序排他，檔案變更先 staging/fsync，發布前再比對 snapshot，失敗 rollback。每檔原子替換不代表跨檔斷電交易；意外退出留下鎖時，不可未確認管理程序狀態就自動刪鎖。
- F25 registry CAS 由 gateway-core 描述；管理操作不跨慢掃描持有鎖，config/credential 變更可讓較早 scan 拒絕發布。
- credential 每 MCP 單一 envVar、多帳號；新增標籤保持 active，不能偷偷改 env key。不同 MCP 同 env key 且值衝突會拒絕；值禁止換行/NUL，短密鑰完全遮罩。仍是明文相容儲存，不是加密。
- 修改設定/credential 後回傳明確 runtime notice：獨立執行中的 Gateway 需重新連線或自己 rescan/reload；extension 讀取刷新不替代這件事，沒有新增 IPC。
- authStatus 的 unknown / not_configured 不是 Token 有效性測試；npm latest 查詢不是已安裝版本比較或更新操作。
- F20：退役 CLI 不可初始化 user-data、安裝依賴或匯出原始 config，因 command/args/env 都可能藏 literal secret；安全 stub 必須保留。

## Evidence Base
- [src/management/servers.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/management/servers.ts)
- [src/management/credentials.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/management/credentials.ts)
- [src/management/storage.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/management/storage.ts)
- [src/management/files.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/management/files.ts)
- [src/management/safety.test.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/management/safety.test.ts)
- [src/management/catalog.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/management/catalog.ts)
- [src/management/versions.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/management/versions.ts)
- [src/registry.concurrent.test.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/registry.concurrent.test.ts)

## Conflicts and Supersession
有效：共用 headless API、zero-touch reads、masked credential、來源安裝/停用 suffix、最多五工具摘要、版本查詢限制、catalog 保留但 extension 不含 Catalog UI。衝突：D13 把 rename helper 當成現行 updateMcp 流程已修正。過期：一般來源一律 append latest 的描述已精確化；storage/safety/CAS 與輸入拒絕行為先前漏載。L01–L07 保留可核對的設計理由，沒有把單檔原子性提升成完整資料庫交易。
