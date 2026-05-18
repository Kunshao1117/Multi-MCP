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
last_updated: '2026-05-19T04:00:53+08:00'
status: stable
staleness: 0
---

# Multi-MCP Gateway — Project Navigation Map (專案導航卡)

## Module Scope
本專案為 **Multi-MCP Gateway**，負責集中管理、橋接與協調多種 Model Context Protocol (MCP) 伺服器，為前端或代理人提供單一且統一的工具呼叫介面。專案具備動態設定載入、認證管理、headless 管理 API 與 VS Code 左側管理延伸模組；舊互動式 CLI 選單已停用。

## Tracked Files
- AGENTS.md

## Architecture Topology
本專案主要劃分為以下核心模組：

### 1. 系統設定與依賴 (`_system`)
- **負責範圍**：技術堆疊定義、執行環境（Node.js, TypeScript）、可用 MCP 伺服器清單（如 Supabase, Sentry, Snyk 等）與佈署設定。
- **記憶路徑**：`.agents/memory/_system/SKILL.md`

### 2. 核心閘道器 (`gateway-core`)
- **負責範圍**：MCP 伺服器生命週期管理、程序池 (Process Pool)、工具路由引擎與註冊表 (Registry) 解析。
- **對應程式碼**：`src/*.ts` (排除 `src/cli/`)
- **記憶路徑**：`.agents/memory/gateway-core/SKILL.md`

### 3. 命令列主控台 (`cli`)
- **負責範圍**：舊 CLI 管理介面原始碼與 catalog 行為；npm `console` 入口已停用並導向 VS Code extension。
- **對應程式碼**：`src/cli/`
- **記憶路徑**：`.agents/memory/cli/SKILL.md`

### 4. Headless 管理 API (`management-api`)
- **負責範圍**：UI 無關的 MCP 安裝、移除、啟停、掃描、認證與版本檢查 API。
- **對應程式碼**：`src/management/`
- **記憶路徑**：`.agents/memory/management-api/SKILL.md`

### 5. VS Code 延伸模組 (`vscode-extension`)
- **負責範圍**：Multi-MCP Manager Activity Bar、Tree View、VSIX 打包與 extension smoke test。
- **對應程式碼**：`extensions/vscode-multi-mcp-manager/`
- **記憶路徑**：`.agents/memory/vscode-extension/SKILL.md`

## Applicable Skills (適用規範)
- `security-sre`：處理認證管理與 API Key 儲存時必須遵循零信任驗證與安全隔離標準。
- `tech-stack-protocol`：任何影響 Gateway 核心或引入新外部依賴時需遵循框架變更協定。

## Key Decisions
- D01: `_map` 作為 Layer 1 頂層導航卡，只描述模組邊界、關聯與適用技能，不承擔具體業務檔案歸屬。
- D02: 具體檔案異動應歸屬於 `_system`、`gateway-core`、`cli`、`management-api` 或 `vscode-extension` 子模組；跨模組修改前先讀取本卡確認邊界。
- D03: `AGENTS.md` 目前承載 GitNexus 治理橋接；修改程式符號前需先做 impact analysis，提交前需做 detect-changes 範圍檢查。
- D04: 若 GitNexus 回報索引 stale，需先執行 `npx gitnexus analyze` 更新索引，再繼續架構探索、影響分析或提交前檢查。
- D05: 2026-05-19 起主要人工管理入口改為 VS Code extension；CLI 選單只保留舊原始碼與遷移提示。

## Known Issues
- 無已知導航卡阻塞問題。

## Module Lessons
- L01: 導航卡不得取代子模組記憶；只需要修改特定邏輯時，直接讀取對應子模組記憶卡可降低上下文噪音。
- L02: `AGENTS.md` 是本專案治理入口，不保存業務程式碼細節；更新時只需同步治理橋接規則與索引入口，不應把子模組檔案責任塞進 `_map`。

## Known Architectural Guidelines
- `_map` 作為 Layer 1 的頂層導航，**不追蹤** 具體的 `.ts` 業務邏輯檔案。所有的檔案異動與錯誤修復應歸屬於 `gateway-core` 或 `cli` 子模組。
- GitNexus 是本專案的程式碼理解與影響分析治理層；若 MCP 工具未直接可用，可使用 `npx gitnexus impact` / `npx gitnexus detect-changes` 走 CLI 等價流程。
- 若專案未來引入更多獨立的功能域（例如 HTTP 傳輸擴充、Dashboard 介面），應於本卡中新增分支並建立新的模組記憶卡。
- `src/management/` 是 extension 與其他 UI 的共用 API 層，不應重新把業務規則寫回 VS Code extension。

## Relations
- _system
- gateway-core
- cli
- management-api
- vscode-extension
