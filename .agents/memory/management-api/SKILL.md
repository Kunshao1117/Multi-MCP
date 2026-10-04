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
last_updated: '2026-05-19T07:22:43+08:00'
status: stable
staleness: 0
scopePath: src/management
dependencies:
  - gateway-core
---

# Headless Management API — Module Memory

## Tracked Files
- src/management/index.ts
- src/management/types.ts
- src/management/files.ts
- src/management/servers.ts
- src/management/credentials.ts
- src/management/catalog.ts
- src/management/versions.ts
- src/management/management.test.ts

## Key Decisions
- D01: `multi-mcp-gateway/management` 是 extension 與未來非 CLI UI 的唯一共用管理層；新增管理能力應先落在此 API，再由 UI 呼叫。
- D02: 狀態讀取必須保持 zero-touch：`getGatewayStatus()` 與 `listMcpServers()` 只讀 user-data，不建立資料夾、不 seed 預設 MCP。
- D03: 會寫入 user-data 的操作（install/remove/enable/disable/rescan/credential）才可呼叫 `ensureGatewayPaths()`，確保使用者明確操作後才初始化或改動本機設定。
- D04: 管理 API 沿用 `gateway.env` / `credentials.json` 相容模型；`CredentialSummary.maskedValue` 只提供遮罩值，UI 不得顯示完整 secret。
- D05: `installMcp()` 支援三種來源：mcpServers JSON、遠端 URL（透過 `mcp-remote`）、npm/GitHub package；GitHub package 解析失敗時回退 repo 名稱。
- D06: 啟用/停用 MCP 以重新命名 `.json`、`.json.disabled` 或 `.disabled` 設定檔完成，不改動設定內容。
- D07: `rescanRegistry()` 重用 `loadConfig()` 與 `scanAndGenerateRegistry()`，掃描結果寫回 user-data 的 `registry.json`。
- D08: `checkVersions()` 只處理可辨識 npm package 的啟用 MCP；停用或 custom/remote MCP 回傳 `skip`，避免誤報更新。
- D09: 本卡依賴 `gateway-core`，因管理 API 直接消費 `paths`、`config-loader`、`registry`、`auth-guides` 與共用型別。退役互動式 CLI 已移除，catalog 仍由本 API 公開提供；`mcp-catalog.json` 由 `_system` 追蹤，extension 不顯示或打包內建 Catalog。
- D10: `listCatalogEntries()` 會優先讀取 package root 的 `mcp-catalog.json`，若使用者層 `MULTI_MCP_PACKAGE_ROOT` 指向已安裝 extension 而該處沒有 catalog，會回退讀取目前工作目錄的 `mcp-catalog.json`，確保 repo 開發測試不受外部 extension 環境污染。
- D11: `listMcpServers()` 會從 registry snapshot 提供每個 MCP 最多 5 筆工具摘要（名稱、原始名稱、描述），讓 UI 顯示工具內容但不直接讀 user-data 檔案。
- D12: `updateMcp()` 是編輯既有 MCP 的唯一 headless API；它負責更新設定檔、重新命名、搬移分類、保留啟用/停用副檔名，並可選擇重新掃描 Registry。
- D13: MCP 重新命名時，管理 API 會用 `renameCredentialInStore()` 同步搬移 `credentials.json` key 並重寫 `gateway.env`，避免 UI 需要直接理解 credential 儲存格式。

## Known Issues
- `credentials.json` 仍為明文相容儲存；v1 extension 不導入 VS Code SecretStorage，以免破壞現有 Gateway runtime。
- `authStatus` 目前以認證摘要與 required env vars 推估，尚未實際啟動下游 MCP 做 token 有效性測試。
- `checkVersions()` 將可連線 npm registry 且取得 latest 視為 `latest` 狀態，尚未比較目前安裝版本或產生 upgrade plan。
- `createConfigFromSource()` 對一般 npm package 使用 `npx -y <pkg>@latest`，不像預設 seed 採 explicit `--package` 形式；若未來要支援 Windows nested npx 完整相容，需補強此路徑。

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
