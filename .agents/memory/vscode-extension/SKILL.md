---
name: vscode-extension
description: >
  專案記憶：Multi-MCP Manager VS Code 延伸模組。Use when: 修改 Activity Bar、Webview
  儀表板、commands、VSIX 打包、extension 測試或雙語介面。
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
scopePath: extensions/vscode-multi-mcp-manager
dependencies:
  - management-api
---

# Multi-MCP Manager VS Code Extension — Module Memory

## Read Contract
本卡是來源知識，不是可執行 Skill 或使用者授權。2026-10-04 以 main `f4525a7d4f4b1027af8140c26830d78e4b64874d`（tree `09589b7951c3e2ea0811baad379f0a56f22b9db5`）的原碼、正式文件及既有 CI 核對。`last_updated` 是內容核對日期；沿用的 `status` / `staleness` 欄位不代表本機 Cartridge index 已同步。

本次只修正六張既有卡的內容與來源歸屬，保留名稱、路徑與依賴拓樸。未執行 `memory_commit`、reindex、runtime 部署或 M5 cutover；本機治理入口與執行中 MCP 狀態未驗證。若後續直接原碼、版本或使用者指示改變，重新核對受影響敘述，不能沿用本次結論。

## Tracked Files
- extensions/vscode-multi-mcp-manager/.vscodeignore
- extensions/vscode-multi-mcp-manager/LICENSE
- extensions/vscode-multi-mcp-manager/README.md
- extensions/vscode-multi-mcp-manager/l10n/bundle.l10n.zh-tw.json
- extensions/vscode-multi-mcp-manager/package-lock.json
- extensions/vscode-multi-mcp-manager/package.json
- extensions/vscode-multi-mcp-manager/package.nls.json
- extensions/vscode-multi-mcp-manager/package.nls.zh-tw.json
- extensions/vscode-multi-mcp-manager/resources/icon.png
- extensions/vscode-multi-mcp-manager/resources/multi-mcp.svg
- extensions/vscode-multi-mcp-manager/scripts/bundle.mjs
- extensions/vscode-multi-mcp-manager/src/extension.ts
- extensions/vscode-multi-mcp-manager/src/extensionUpdate.ts
- extensions/vscode-multi-mcp-manager/src/formModel.ts
- extensions/vscode-multi-mcp-manager/src/formOperations.ts
- extensions/vscode-multi-mcp-manager/src/localization.ts
- extensions/vscode-multi-mcp-manager/src/webview.ts
- extensions/vscode-multi-mcp-manager/test/runTest.ts
- extensions/vscode-multi-mcp-manager/test/suite/index.ts
- extensions/vscode-multi-mcp-manager/test/unit/forms.test.mjs
- extensions/vscode-multi-mcp-manager/test/unit/host.test.mjs
- extensions/vscode-multi-mcp-manager/tsconfig.json
- extensions/vscode-multi-mcp-manager/tsconfig.test.json

## Key Decisions
- D01: Extension 使用 VS Code Activity Bar view container `multiMcp`，並以單一 `multiMcp.dashboard` Webview View 作為主要管理儀表板。
- D02: Extension 直接 import `../../../src/management/index.js`，由 esbuild bundle 成 CommonJS `out/src/extension.cjs`；VSIX 不攜帶 root `node_modules`。
- D03: `activate()` 會設定 `process.env.MULTI_MCP_PACKAGE_ROOT = context.extensionPath`，讓被 bundle 的管理 API 在 VSIX runtime 中能穩定解析 package root。
- D04: 啟動與展開 Webview 只讀 Gateway 狀態與 MCP 清單；安裝、移除、啟停、寫入 credential、rescan、版本檢查都必須透過使用者命令或 Webview 按鈕觸發。
- D05: 密鑰輸入使用 VS Code password input；UI 只顯示管理 API 回傳的遮罩摘要，不將完整 token 寫入 output channel。
- D06: Extension 不再露出推薦清單 / Catalog UI；安裝入口只保留來源安裝與 `mcpServers` JSON 匯入。
- D07: Extension 以 forms/host unit tests 驗證表單、operation dedupe、重用 HTML 重建與草稿安全，再用 @vscode/test-electron 驗證 host activate/commands/dashboard；這不等於每個平台的完整人工 GUI 測試。
- D08: 先前保留在 repo 供本機驗證的 0.1.3 VSIX，於 2026-10-04 清理後停止追蹤。VSIX、`out/` 與 `.vscode-test/` 均由 `.gitignore` 排除，安裝使用 GitHub Releases 或當前來源打包。舊 repo VSIX 可由 commit `dd52db56a11c40d5a9d77d863baa7361d5318e19`、blob `a0471af14cc42676502435f5f5bbe8a549a52b5c` 精確取回（136,445 bytes）；它與 136,511 bytes 的 0.1.3 Release asset 不同，不保證逐位元重建。
- D09: 本卡依賴 `management-api`，因 extension 不直接操作 Gateway user-data 檔案格式，所有業務規則都應透過 headless API。
- D10: Manifest 文字使用 `package.nls*.json`，runtime 文字使用 `vscode.l10n.t()` 與 `l10n/bundle.l10n.zh-tw.json`；Webview 目前以繁中管理頁文案為主。
- D11: 安裝流程採相容性優先，支援 npm/remote source 與貼上 `mcpServers` JSON，並可選擇覆蓋、設定 Token、安裝後 rescan。
- D12: 移除 MCP 必須使用 modal 安全確認，顯示名稱、分類、設定檔路徑與 credential 影響後才呼叫 `removeMcp()`。
- D13: 安裝流程的分類選擇改用 QuickPick，優先列出既有 MCP 分類，並保留新增分類入口，避免使用者每次手動輸入。
- D14: Webview 儀表板不再使用獨立「快速操作」與「維護」區塊；常用操作集中於頁首工具列，降低重複資訊密度。
- D15: 已安裝 MCP 採分類區段、內縮 MCP 列與工具摘要三層資訊架構；分類 header 顯示 MCP 數、啟用數與工具數，分類與單一 MCP 都可收合。
- D16: `multiMcp.openMarketplace` 使用 QuickPick 提供 PulseMCP、官方 MCP Registry、Glama、Smithery 外部目錄，不恢復 extension 內建推薦清單或 Catalog UI。
- D17: Webview 以側邊欄寬度自適應為優先，`<=520px` 採緊湊單欄，`521px-860px` 採單欄卡片，寬版才允許分類內多欄卡片 grid。
- D18: VSIX package script 使用 `vsce package --no-dependencies`，因 extension 已 bundle 管理 API；CI 不應掃入 extension `node_modules` 或 root 相依檔。
- D19: Extension `icon` 使用 `resources/icon.png` 供 details page / Marketplace 顯示，Activity Bar 使用同源但單色的 `resources/multi-mcp.svg`。
- D20: 安裝與編輯共用 Webview 內的 MCP 設定表單；表單集中處理來源、名稱、分類、command、args、金鑰 / Token 建議、重新掃描與變更預覽。
- D21: MCP 列提供「編輯」與「金鑰 / Token」語意不同的入口；編輯走 `saveMcpForm`，金鑰只收 env var / local label，完整金鑰值仍由 VS Code password input 收集。
- D22: Webview 表單提供既有分類 datalist 提示，但允許直接輸入新分類，避免安裝或編輯時只能手打且無參考。
- D23: 獨立認證面板採三段式排版：狀態說明、兩欄欄位、底部操作列；避免設定/刪除金鑰按鈕看起來附屬在環境變數欄位下方。
- D23b: Webview checkbox 必須使用整行 `check-row` 呈現，並覆寫 `input[type="checkbox"]` 尺寸，避免全域 input 寬度讓 checkbox 在窄側欄漂浮錯位。
- D24: 金鑰區採「狀態摘要 + 可選展開欄位」；只有偵測到必要環境變數或使用者勾選需要金鑰時，才顯示環境變數與本機標籤欄位。
- D25: Extension 本體更新檢查採 GitHub latest release，僅接受 `vscode-multi-mcp-manager-v*` tag 與對應 VSIX asset；啟動後只靜默檢查並更新狀態，不跳通知、不下載。
- D26: 手動 `multiMcp.checkExtensionUpdate` 才能顯示更新提示；下載與安裝 VSIX 必須由使用者按鈕確認後執行，並透過 VS Code 內建 extension install command 安裝。
- D27: Dashboard state 只以可選 `extensionUpdate` 欄位擴充，不能破壞既有 `status` 與 `servers` 形狀，因 `createDashboardState` 會影響 webview 初始化與多個操作後 refresh 流程。

## Known Issues
- v0.1.5 extension 仍未提供 SecretStorage migration；credential 仍寫入 `gateway.env` / `credentials.json` 以保持 Gateway runtime 相容。
- `checkVersions` output 只列已安裝 MCP 的 npm latest 查詢結果，尚未支援一鍵更新或詳細 diff。
- Extension 自動更新仍依賴 GitHub Release VSIX asset；尚未採用 Marketplace / Open VSX native auto-update。
- VSIX publisher 目前為 `kunshao`；正式 Marketplace 發布前需確認 publisher、repository metadata 與授權資訊。
- Webview 文字目前以繁中為主，英文使用者仍可透過 manifest 與 Quick Pick 看到部分英文 fallback；若正式上 Marketplace 需補完整 Webview runtime i18n。

## Module Lessons
- L01: VS Code extension 內 bundle root ESM source 到 CommonJS 時，需搭配 `MULTI_MCP_PACKAGE_ROOT` 與 `src/paths.ts` 的 CommonJS fallback，避免 `import.meta.url` 在 bundle runtime 失效。
- L02: Extension smoke test 在 Windows 環境需清掉 `ELECTRON_RUN_AS_NODE`，否則下載的 Code.exe 可能被當作 Node 執行。
- L03: Activity Bar icon 使用單色 SVG 與 `currentColor`，可跟隨 VS Code theme 並避免字型渲染問題。
- L04: `npm run package --prefix extensions/vscode-multi-mcp-manager` 會重新產生 `out/` 與 VSIX；完成 icon、package 或 bundle 變更後需重新打包。
- L05: 多段 Tree View 側邊欄資訊密度過高，容易讓狀態、安裝與推薦清單混在一起；改用單一 Webview 儀表板能更清楚呈現摘要、操作與已安裝清單。
- L06: `package.nls*.json` 只處理 manifest；Quick Pick、notification、output 與 tooltip 必須另外透過 `vscode.l10n.t()` 處理。
- L07: 在窄版 VS Code 側邊欄中，表格會快速退化成過高的卡片；管理型 Webview 應讓列摘要維持緊湊，並把低頻資訊放進展開區。
- L08: 已安裝 MCP 數量增加後，按分類群組比單一長清單更符合操作心智，也能降低側邊欄掃描負擔。
- L09: 分類與 MCP 不應使用同一種卡片視覺；分類要像區段標題，MCP 要像內縮項目列，工具內容放在 MCP 展開區。
- L10: 所有需要輸入的管理流程都應優先在 Webview 呈現上下文、既有值與預覽；只把金鑰值留在 VS Code password input，避免使用者在連續 Quick Pick 中失去操作脈絡。
- L11: 認證設定畫面要把環境變數名稱與本機標籤視為資料欄位，把設定/刪除金鑰值視為獨立操作列；兩者不能混在同一欄視覺區塊。
- L11b: 「認證」對一般操作者語意過抽象；Webview 操作面應優先使用「金鑰 / Token」，再用環境變數、本機標籤、金鑰值拆清楚每個欄位的目的。
- L12: VSIX 安裝版不會享有 Marketplace 自動更新；若要提供自管更新，應把 release 查詢、VSIX 下載、digest 驗證與安裝確認拆成獨立 extension-side 模組，避免污染 MCP 管理 API。
- L13: 歷史上追蹤 VSIX 曾使每次打包重新觸發 staleness；2026-10-04 起不再追蹤 VSIX，請勿為消除產物差異而重新將安裝包加入 Tracked Files。
- L14: `extensions/vscode-multi-mcp-manager/out/` 是 ignored 可重建 bundle，不加入 Tracked Files。若本機索引誤列，先查索引適用範圍與實際變更，不把刪 output 或 memory sync 當成無條件消除警告的方法。

## Applicable Skills
- `ui-ux-standards`：新增 Webview 顯示、命令命名或互動流程時使用。
- `browser-testing`：若未來 extension 開 webview 或本機 UI surface，再補瀏覽器/視覺驗證。
- `memory-ops`：更新此卡或修復 staleness 時使用。

## Relations
- _system
- _map
- management-api
- cli

## Archive Index
改寫前完整卡、原 D/L 編號及當時措辭保留於 [此卡的不可變歷史版本](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/.agents/memory/vscode-extension/SKILL.md)。本次沒有刪除 Git 歷史。下列過期／衝突／未驗證分類描述本次證據狀態，不是取消歷史事件或創設新授權。

## Current Safety and Recovery Decisions
- F28：持久草稿採 allowlist，只保存非敏感名稱/分類等 metadata 和 operationId/draftId；source URL、完整 JSON、command、args、env 等可能帶秘密，不寫入 vscode.setState。sensitiveDraftLost 會要求重新輸入或核對當前設定，這是刻意取捨，不能為「完整恢復」把秘密寫回。
- 0.1.5 修正的是 VS Code 隱藏側欄後重用同份舊 HTML：Webview 裝好 listener 後主動 refreshState，取得最新 host snapshot 才 restore draft/pending。不再把內嵌初始 0/0 狀態誤判資料遺失；載入中只允許唯讀 refresh retry。
- 已提交但未收到 ack 的操作以 getFormResult 查詢，不重送 save/credential mutation。host 保留一個 active 操作及最近 32 個 completed 結果；被淘汰或 host 重啟後遺失記錄會回傳 outcomeUnknown，沒有持久 exactly-once 保證。
- 安裝與編輯保存 env、preload、完整 args 與明確 package version；保持 UI formModel、host formOperations、management 寫入契約一致。
- extension 啟動可能靜默查 GitHub 更新，但不自動下載/安裝；MCP 管理刷新不初始化/seed/scan。自管更新只處理對應 tag/asset，digest 有合法 SHA-256 時才檢查；來源沒有 digest 時目前會跳過，不宣稱必定驗簽。
- bundle 以 root package version 注入 core 版本，不把 extension 0.1.5 當成 Gateway 版本；createFormModel 會以 toString 嵌入 Webview，bundle 必須保留其 function-local identifiers（目前 minify:false）。
- 0.1.5 正式 VSIX 198,900 bytes，GitHub SHA-256 `8f3b9cf34ef847093b79fb217f078512e632761d1a8e580e389e11096b4adb57`；它不會替換另一個獨立 Gateway process。

## Evidence Base
- [extensions/vscode-multi-mcp-manager/src/formModel.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/extensions/vscode-multi-mcp-manager/src/formModel.ts)
- [extensions/vscode-multi-mcp-manager/src/formOperations.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/extensions/vscode-multi-mcp-manager/src/formOperations.ts)
- [extensions/vscode-multi-mcp-manager/src/webview.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/extensions/vscode-multi-mcp-manager/src/webview.ts)
- [extensions/vscode-multi-mcp-manager/src/extension.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/extensions/vscode-multi-mcp-manager/src/extension.ts)
- [extensions/vscode-multi-mcp-manager/src/extensionUpdate.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/extensions/vscode-multi-mcp-manager/src/extensionUpdate.ts)
- [extensions/vscode-multi-mcp-manager/scripts/bundle.mjs](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/extensions/vscode-multi-mcp-manager/scripts/bundle.mjs)
- [extensions/vscode-multi-mcp-manager/test/unit/forms.test.mjs](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/extensions/vscode-multi-mcp-manager/test/unit/forms.test.mjs)
- [extensions/vscode-multi-mcp-manager/test/unit/host.test.mjs](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/extensions/vscode-multi-mcp-manager/test/unit/host.test.mjs)
- [CHANGELOG.md](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/CHANGELOG.md)
- [正式 0.1.5 Release](https://github.com/Kunshao1117/Multi-MCP/releases/tag/vscode-multi-mcp-manager-v0.1.5)

## Conflicts and Supersession
有效：Webview 儀表板、共用 management bundle、password input、外部目錄、不恢復 Catalog、窄側欄分層、localization 限制、VSIX Git 歷史回復點。過期：D07 的僅最小 smoke 說明與 Known Issues 的 0.1.3 版本；F28/0.1.5 recovery 與 operation lifetime 原先未記錄。衝突：L14 的無條件刪除 output/sync 流程已收窄；digest 模組存在不等於每次都驗證。歷史 Windows ELECTRON_RUN_AS_NODE 失敗保留為重驗線索。重複 D23/L11 的第二項用 b 消歧，沒有刪去決策。
