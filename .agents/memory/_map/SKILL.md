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
last_updated: '2026-05-04T21:29:39+08:00'
status: stable
staleness: 0
---

# Multi-MCP Gateway — Project Navigation Map (專案導航卡)

## 專案概述
本專案為 **Multi-MCP Gateway**，負責集中管理、橋接與協調多種 Model Context Protocol (MCP) 伺服器，為前端或代理人提供單一且統一的工具呼叫介面。專案具備動態設定載入、認證管理與 CLI 操作主控台。

## Tracked Files
- (無直接追蹤檔案，作為導航層使用)

## 架構拓樸 (Architecture Topology)

本專案主要劃分為以下核心模組：

### 1. 系統設定與依賴 (`_system`)
- **負責範圍**：技術堆疊定義、執行環境（Node.js, TypeScript）、可用 MCP 伺服器清單（如 Supabase, Sentry, Snyk 等）與佈署設定。
- **記憶路徑**：`.agents/memory/_system/SKILL.md`

### 2. 核心閘道器 (`gateway-core`)
- **負責範圍**：MCP 伺服器生命週期管理、程序池 (Process Pool)、工具路由引擎與註冊表 (Registry) 解析。
- **對應程式碼**：`src/*.ts` (排除 `src/cli/`)
- **記憶路徑**：`.agents/memory/gateway-core/SKILL.md`

### 3. 命令列主控台 (`cli`)
- **負責範圍**：CLI 管理介面，提供安裝/移除 MCP、認證憑證管理 (`credentials.json`)、工具瀏覽與狀態檢查。
- **對應程式碼**：`src/cli/`
- **記憶路徑**：`.agents/memory/cli/SKILL.md`

## Relations (關聯子模組)
- `_system`
- `gateway-core`
- `cli`

## Applicable Skills (適用規範)
- `security-sre`：處理認證管理與 API Key 儲存時必須遵循零信任驗證與安全隔離標準。
- `tech-stack-protocol`：任何影響 Gateway 核心或引入新外部依賴時需遵循框架變更協定。

## 未來追蹤重點 (Known Architectural Guidelines)
- `_map` 作為 Layer 1 的頂層導航，**不追蹤** 具體的 `.ts` 業務邏輯檔案。所有的檔案異動與錯誤修復應歸屬於 `gateway-core` 或 `cli` 子模組。
- 若專案未來引入更多獨立的功能域（例如 HTTP 傳輸擴充、Dashboard 介面），應於本卡中新增分支並建立新的模組記憶卡。
