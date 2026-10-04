---
name: cli
description: >
  專案記憶：退役 CLI 的安全相容入口與歷史決策。互動式模組已移出來源樹；新的管理介面請優先使用 management-api 與
  vscode-extension 記憶卡。 Use when: 維護 CLI 安全停用入口或查閱退役歷史。
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

# Legacy CLI Console — Module Memory

## Read Contract
本卡是來源知識，不是可執行 Skill 或使用者授權。2026-10-04 以 main `f4525a7d4f4b1027af8140c26830d78e4b64874d`（tree `09589b7951c3e2ea0811baad379f0a56f22b9db5`）的原碼、正式文件及既有 CI 核對。`last_updated` 是內容核對日期；沿用的 `status` / `staleness` 欄位不代表本機 Cartridge index 已同步。

本次只修正六張既有卡的內容與來源歸屬，保留名稱、路徑與依賴拓樸。未執行 `memory_commit`、reindex、runtime 部署或 M5 cutover；本機治理入口與執行中 MCP 狀態未驗證。若後續直接原碼、版本或使用者指示改變，重新核對受影響敘述，不能沿用本次結論。

## Tracked Files
- console.ps1
- src/cli.ts
- src/cli/import-export.ts

## Current State — 2026-10-04
- 僅追蹤上述 3 個安全停用入口；`src/management/safety.test.ts` 的 F20 要求它們不得初始化、安裝依賴或匯出原始設定。
- 11 個互動式模組及 `src/credential-store.ts` legacy wrapper 已退役；完整來源保留於清理前 commit `dd52db56a11c40d5a9d77d863baa7361d5318e19` 的 Git 歷史。
- catalog 仍由 `multi-mcp-gateway/management` 的 `listCatalogEntries()` 公開提供，資料檔由 `_system` 追蹤；extension 不顯示或打包內建 Catalog。不要恢復舊互動式 UI 或建立不存在的 extension catalog 副本。
- 以下決策、問題與教訓保留作退役歷史，並非現行實作或待修需求；其中 D01/D07/D16/D19/D23/L10 已被本節現況與 F20 安全限制取代。

## Historical Key Decisions
- D01: 互動式 CLI 選單原始碼仍保留於 `src/cli/`，但 npm `console` 入口已停用並輸出 VS Code extension 遷移提示
- D02: 安裝 MCP 時三層自動辨識：已知提示 → 試啟動偵測 → 手動輸入
- D03: 同步認證功能可從 gateway.env 反向匯入到 credentials.json
- D04: 來源偵測支援 GitHub URL、npm 套件名、遠端 MCP URL 三種格式
- D05: Monorepo 偵測：若偵測到 workspaces 欄位會提示使用者確認套件名
- D06: readline 單例模式——由 shared.ts 持有並匯出，所有子模組共用同一實例
- D07: 拆分為 13 個子模組，cli.ts 為純路由入口
- D08: installMCP 和 removeMCP 透過回呼函式注入 rescan，避免子模組間循環依賴
- D09: 主選單採四組分類（MCP 管理 / 工具與診斷 / 系統設定 / 進階）
- D10: ANSI 色碼常數集中定義於 shared.ts 的 `c` 物件，所有模組共用
- D11: 儀表板從 registry.json + credentials.json + mcps/ 三個資料來源即時計算
- D12: MCP 市集三種安裝途徑：npm 搜尋 → 推薦清單（支援批次）→ 手動輸入
- D13: 推薦清單存放於 mcp-catalog.json，隨專案分發，使用者可自行擴充
- D14: 健康檢查自行解析 ${VAR} 佔位符，不依賴 config-loader 私有函式
- D15: 工具瀏覽器復用 registry.ts 的 searchTools() 函式
- D16: 匯出設定保留 MCP 啟動結構但不含實際密鑰值
- D17: 版本檢查直接查詢 npm 公開 API，遠端 MCP 自動跳過
- D18: 同步認證從主選單獨立項目整合至認證管理子選單（[S] 選項）
- D19: console.ps1 加入 Node.js / node_modules 前置檢查，確保外部使用者零門檻啟動
- D20: CLI 共用路徑改由 `src/paths.ts` 提供；`PROJECT_ROOT` 保留舊名稱相容，但語義已改為使用者資料根目錄
- D21: `rescan()` 直接呼叫 `loadConfig(CONFIG_PATH)` 與 `scanAndGenerateRegistry(config, REGISTRY_PATH)`，不再 shell out 到 `npx tsx src/index.ts --scan`
- D22: 推薦清單固定讀取 npm package 內的 `mcp-catalog.json`；使用者的 MCP 設定與 registry 則寫入本機資料夾
- D23: `mcp-catalog.json` 現在同時供舊 console marketplace 與 VS Code extension catalog 使用，不等於預設啟用清單；預設啟用由 `src/paths.ts` 的一次性 seed 控制
- D24: 需要 Token 的 GitHub、Sentry、Stitch 可保留在 catalog 供管理介面安裝與認證引導，但不得進入無金鑰預設 seed
- D25: CLI 健康檢查與認證需求探測啟動下游 MCP 時使用 `createDownstreamEnv()`，避免 Gateway 由 npm/npx 啟動時外層 npm lifecycle 變數污染內層 npx
- D26: 新功能不得再擴充互動式 CLI 選單；請改擴充 `src/management/` headless API 與 VS Code extension。

## Historical Known Issues
- （已解決）cli.ts 原 888 行超過閾值──已完成拆分重構
- （已解決）主控台新增與更新權限時，空白字串造成無聲音中斷操作（已加入 trim 防錯邏輯與明確錯誤提示）
- （已解決）安裝流程輸入 mcpServers JSON 時，殘餘 JSON 行污染後續 prompt 導致檔名錯誤（已在 install-flow.ts 加入預處理快速路徑）
- 健康檢查逐一串列測試（非並行），MCP 數量多時較慢
- 推薦清單 mcp-catalog.json 需手動維護，無自動更新機制

## Historical Module Lessons
- L01: 拆分互動式 CLI 時，readline 實例不可分散建立，必須集中持有避免 stdin 搶佔
- L02: 子模組間如需交叉呼叫（如安裝後觸發掃描），應以回呼注入而非直接 import 對方模組
- L03: config-loader.ts 的 resolveEnvVars 為私有函式，新模組需自行實作環境變數解析
- L04: Node.js 內建 fetch（18+）足以呼叫 npm 公開 API，無需額外依賴
- L05: 主控台互動輸入時，若使用者輸入空白（按 Enter），`ask` 會回傳空字串並使狀態防護中斷。應使用 `.trim()` 清理輸入，並在判斷條件失敗時明確印出 `❌ 操作取消` 訊息，避免使用者誤以為保存成功或操作失效。
- L06: 互動式 CLI 的 readline `ask()` 會逐行消化 stdin；遇到多行內容（如貼入 JSON）時，殘餘行會污染後續的 prompt 回答。正確做法：在進入流程前先預處理輸入，正常格式引導快速跳出路徑，焦點進入原有流程。
- L07: CLI 隨 npm package 執行時不能依賴 repo 內的 `src/` 或目前工作目錄；掃描、認證、匯出匯入與工具瀏覽都必須走共用 user-data paths
- L08: catalog 內的 `package` 欄位會被 install flow 當作使用者提示來源；若 npm 套件不存在或 deprecated，文件描述必須明確標示風險，避免公開安裝流程導向壞端點
- L09: 若 CLI/健康檢查是在 tarball npx 情境中執行，下游 package 最好使用 explicit `--package <pkg> -- <bin>` 形態；單純 `npx -y <pkg>@latest` 在 Windows nested npx 下可能被誤解析
- L10: `mcp-catalog.json` 若更新版本或推薦清單，需同步 `extensions/vscode-multi-mcp-manager/mcp-catalog.json`，否則 VSIX 內 catalog 會落後。

## Relations
- _system
- gateway-core
- management-api
- vscode-extension

## Archive Index
改寫前完整卡、原 D/L 編號及當時措辭保留於 [此卡的不可變歷史版本](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/.agents/memory/cli/SKILL.md)。本次沒有刪除 Git 歷史。下列過期／衝突／未驗證分類描述本次證據狀態，不是取消歷史事件或創設新授權。

## Published Artifact Boundary
main 已移除 12 個退役來源，但 npm 1.2.1 是清理前發布，仍含其 48 個編譯輸出。source 保留 3 個安全入口；乾淨 npm 包保留 `cli` 與 `cli/import-export` 兩個 TypeScript stub 的編譯輸出，`console.ps1` 僅在 repo。不能把來源刪除視為已發布升級，也不能為了清潔列表恢復互動 UI。

## Evidence Base
- [src/cli.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/cli.ts)
- [src/cli/import-export.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/cli/import-export.ts)
- [console.ps1](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/console.ps1)
- [src/management/safety.test.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/management/safety.test.ts)
- [scripts/verify-release-tarball.mjs](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/scripts/verify-release-tarball.mjs)
- [CHANGELOG.md](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/CHANGELOG.md)
- [清理 PR #3：consumer 查核、原始碼回復點與 package 對照](https://github.com/Kunshao1117/Multi-MCP/pull/3)

## Conflicts and Supersession
有效：現行三個安全 stub、公開 management catalog、不恢復 CLI。過期：Historical D01/D07/D19/D23/L10 分別涉及已刪互動來源、拆分數、會安裝依賴的啟動器與 extension catalog 副本，均不得照做。Historical D16「匯出不含金鑰」不能作安全保證：command/args/env literal secrets 仍可能外洩，所以 F20 禁用 legacy export。其餘 Historical D/L 與已解 CLI 失敗保留為退役設計與教訓，不宣稱本次重新驗證或列為現行待修。
