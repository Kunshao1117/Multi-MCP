---
name: _map
description: >
  [Infra] Multi-MCP 專案架構索引卡（_map 導航卡）。 Use when: 需要了解專案全局架構、尋找特定模組（如 Gateway,
  CLI, 設定檔）位置，或進行大範圍跨模組修改前載入。 DO NOT use when: 只需要修改特定子模組邏輯時（請直接載入該子模組記憶）。
metadata:
  author: antigravity
  version: '1.0'
  origin: memory-arch
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
last_updated: '2026-10-04T18:40:00Z'
status: stable
staleness: 0
---

# Multi-MCP Gateway — Project Navigation Map (專案導航卡)

## Read Contract
本卡是來源知識，不是可執行 Skill 或使用者授權。2026-10-04 以 main `f4525a7d4f4b1027af8140c26830d78e4b64874d`（tree `09589b7951c3e2ea0811baad379f0a56f22b9db5`）的原碼、正式文件及既有 CI 核對。`last_updated` 是內容核對日期；沿用的 `status` / `staleness` 欄位不代表本機 Cartridge index 已同步。

本次只修正六張既有卡的內容與來源歸屬，保留名稱、路徑與依賴拓樸。未執行 `memory_commit`、reindex、runtime 部署或 M5 cutover；本機治理入口與執行中 MCP 狀態未驗證。若後續直接原碼、版本或使用者指示改變，重新核對受影響敘述，不能沿用本次結論。

## Module Scope
本專案為 **Multi-MCP Gateway**，負責集中管理、橋接與協調多種 Model Context Protocol (MCP) 伺服器，為前端或代理人提供單一且統一的工具呼叫介面。專案具備動態設定載入、認證管理、headless 管理 API 與 VS Code 左側管理延伸模組；舊互動式 CLI 選單已停用。

## Tracked Files
本卡只導航，不擁有業務檔案。原列 `AGENTS.md` 是 ignored 本機入口，並不存在於本次 tracked tree；不列為已驗證歸屬。

## Architecture Topology
本專案主要劃分為以下核心模組：

### 1. 系統設定與依賴 (`_system`)
- **負責範圍**：技術堆疊定義、執行環境（Node.js, TypeScript）、repo 的 MCP 設定示例、一次性 seed 與打包／發布設定；不表示使用者目前已安裝或登入下游服務。
- **記憶路徑**：`.agents/memory/_system/SKILL.md`

### 2. 核心閘道器 (`gateway-core`)
- **負責範圍**：MCP 伺服器生命週期管理、程序池 (Process Pool)、工具路由引擎與註冊表 (Registry) 解析。
- **對應程式碼**：`src/` 的頂層核心模組與對應測試；不包含 `src/cli.ts`、`src/cli/` 或 `src/management/`
- **記憶路徑**：`.agents/memory/gateway-core/SKILL.md`

### 3. 命令列主控台 (`cli`)
- **負責範圍**：CLI 安全停用入口與退役歷史；來源樹已移除互動式模組，npm `console` 入口僅提示改用 VS Code extension，catalog 由 management API 提供。已發布 npm 1.2.1 仍含舊編譯輸出，不能把 main 清理當作已重新發布。
- **對應程式碼**：`src/cli.ts`、`src/cli/import-export.ts`、`console.ps1`
- **記憶路徑**：`.agents/memory/cli/SKILL.md`

### 4. Headless 管理 API (`management-api`)
- **負責範圍**：UI 無關的 MCP 安裝、移除、啟停、掃描、認證與版本檢查 API。
- **對應程式碼**：`src/management/`
- **記憶路徑**：`.agents/memory/management-api/SKILL.md`

### 5. VS Code 延伸模組 (`vscode-extension`)
- **負責範圍**：Multi-MCP Manager Activity Bar、Webview 儀表板、表單／host 測試、VSIX 打包與 VS Code smoke test。
- **對應程式碼**：`extensions/vscode-multi-mcp-manager/`
- **記憶路徑**：`.agents/memory/vscode-extension/SKILL.md`

## Applicable Skills (適用規範)
歷史卡曾引用 `security-sre`、`tech-stack-protocol`、`memory-ops` / `memory-arch`。這些名稱是查找線索；本 repo 不提交其內容或版本，不能從卡名推論目前治理已啟用。需要本機規範時，先讀取該執行環境真正可用的入口。

## Key Decisions
- D01: `_map` 只描述模組邊界、關聯與查找路線，不承擔具體業務檔案歸屬。
- D02: 檔案歸屬由 `_system`、`gateway-core`、`cli`、`management-api` 或 `vscode-extension` 負責；依問題讀最小相關卡。
- D03: `.gitignore` 明確排除 `AGENTS.md`、`CLAUDE.md`、`.codex/` 與除 memory 外的 `.agents/*`。本次 remote tree 沒有可讀治理投影；不能確認舊卡所述 GitNexus impact/detect-changes 規則仍適用。
- D04: 本機 GitNexus / Cartridge 索引不提交；沒有讀到實際索引就不報 stale 已清零、impact 已通過或 index 已同步。
- D05: 人工管理入口是 VS Code extension；退役 CLI 只保留安全停用與遷移提示，不恢復互動 UI。
- D06: 同 owner 的另一個規則 repo 不會自動成為本 repo 的有效治理版本；本次沒有可驗證的 AI_Rules/M5 引用鏈，既不宣稱已 cutover，也不從缺席推論本機完全沒有規範。

## Known Issues
來源導航已可核對；本機 ignored 治理入口、索引與實際部署狀態不在本次證據範圍。

## Module Lessons
- L01: 卡片提供線索，當前行為仍需以同版本原碼、測試和正式文件驗證。
- L02: 把 ignored 本機規範當成 clone 後必然存在的 tracked 檔案，會製造 ghost ownership 與虛假的治理通過聲明；需分開記錄來源證據和執行環境證據。

## Known Architectural Guidelines
- `src/management/` 是 extension 與其他 UI 的共用 API 層，業務規則不應在 extension 重複實作。
- CLI、Gateway core、management 和 extension 為不同 owner，不能把所有 `.ts` 都歸 core/CLI。
- 新增 HTTP transport 或其他功能域前應重新判斷範圍與 owner；本卡並未批准擴充功能或新拓樸。

## Relations
- _system
- gateway-core
- cli
- management-api
- vscode-extension

## Archive Index
改寫前完整卡、原 D/L 編號及當時措辭保留於 [此卡的不可變歷史版本](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/.agents/memory/_map/SKILL.md)。本次沒有刪除 Git 歷史。下列過期／衝突／未驗證分類描述本次證據狀態，不是取消歷史事件或創設新授權。

## Evidence Base
- [.gitignore](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/.gitignore)
- [README.md](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/README.md)
- [package.json](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/package.json)
- [src/management/index.ts](https://github.com/Kunshao1117/Multi-MCP/blob/f4525a7d4f4b1027af8140c26830d78e4b64874d/src/management/index.ts)

## Conflicts and Supersession
舊 D01/D02/D05/L01 的導航意圖有效；舊 D03/D04/D06/L02 的本機 GitNexus/AGENTS 敘述未驗證，不再作當前治理命令。Tracked Files 的 AGENTS.md 與舊「所有檔案歸 core/CLI」分類已更正；五個模組與依賴拓樸保持不變。
