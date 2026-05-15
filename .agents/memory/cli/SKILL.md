---
name: cli
description: >
  專案記憶：CLI 管理主控台（安裝/移除 MCP、認證管理、分類管理、市集、健康檢查、工具瀏覽器、版本檢查、匯出匯入）。 Use when: 修改 CLI
  主控台/管理介面/使用者互動流程 的任務。
metadata:
  author: antigravity
  version: '1.0'
  origin: memory-arch
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
    - 'mcp:cartridge-system'
last_updated: '2026-05-15T17:03:07+08:00'
status: stable
staleness: 0
---

# CLI Console — Module Memory

## Tracked Files

- src/cli.ts
- src/cli/shared.ts
- src/cli/source-detector.ts
- src/cli/install-flow.ts
- src/cli/auth-manager.ts
- src/cli/category-manager.ts
- src/cli/mcp-manager.ts
- src/cli/dashboard.ts
- src/cli/marketplace.ts
- src/cli/health-check.ts
- src/cli/tool-browser.ts
- src/cli/import-export.ts
- src/cli/version-check.ts
- mcp-catalog.json
- console.ps1

## Key Decisions

- D01: CLI 採互動式選單設計，支援安裝/移除/認證/分類/掃描/同步六大功能
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

## Known Issues

- （已解決）cli.ts 原 888 行超過閾值──已完成拆分重構
- （已解決）主控台新增與更新權限時，空白字串造成無聲音中斷操作（已加入 trim 防錯邏輯與明確錯誤提示）
- (已解决) 安裝流程輸入 mcpServers JSON 時，殘餘 JSON 行污染後續 prompt 導致檔名錯誤（已在 install-flow.ts 加入預處理快速路徑）
- 健康檢查逐一串列測試（非並行），MCP 數量多時較慢
- 推薦清單 mcp-catalog.json 需手動維護，無自動更新機制

## Module Lessons

- L01: 拆分互動式 CLI 時，readline 實例不可分散建立，必須集中持有避免 stdin 搶佔
- L02: 子模組間如需交叉呼叫（如安裝後觸發掃描），應以回呼注入而非直接 import 對方模組
- L03: config-loader.ts 的 resolveEnvVars 為私有函式，新模組需自行實作環境變數解析
- L04: Node.js 內建 fetch（18+）足以呼叫 npm 公開 API，無需額外依賴
- L05: 主控台互動輸入時，若使用者輸入空白（按 Enter），`ask` 會回傳空字串並使狀態防護中斷。應使用 `.trim()` 清理輸入，並在判斷條件失敗時明確印出 `❌ 操作取消` 訊息，避免使用者誤以為保存成功或操作失效。
- L06: 互動式 CLI 的 readline `ask()` 會逐行消化 stdin；到多行內容（如貼入 JSON）時，残餘行會汚染後續的 prompt 回答。正確做法：在進入流程前先預處理輸入，正常格式引導快速跳出路徑，焦點進入原有流程。

## Relations

- \_system
- gateway-core
