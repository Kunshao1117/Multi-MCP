---
name: mem-gateway-core
description: >
  專案記憶：Gateway 核心模組（設定載入、程序池、路由引擎、集成表、日誌、認證指南）。 Use when:
  修改閘道器核心邏輯、程序管理、工具路由、掃描機制 的任務。
last_updated: 2026-03-28T02:50:00.000Z
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

## Known Issues
- credentials.json 明文儲存密鑰，雖被 .gitignore 排除但缺少加密層
- （已解決）cli.ts 原 888 行超閾值——已完成拆分為 6 個子模組

## Module Lessons
- L01: vi.fn 泛型語法 vi.fn<[], T>() 在 TypeScript 5.7+vitest 3.0 下報 TS2558，需改為無泛型呼叫
- L02: 模擬 MCP SDK 需用 vi.hoisted 宣告 mock 函式，確保 vi.mock 工廠可引用外部變數
- L03: 不同 AI 模型/IDE 可能將數字參數傳為字串，下游 MCP 的 Zod 驗證器會拒絕；閘道器應在轉發前根據 schema 容錯強轉
- L04: MCP SDK Client.callTool() 僅接受 name 與 arguments，不支援 env 欄位；工作目錄注入需透過其他機制（如 process-pool spawn cwd）實現，本次採狀態儲存方案

## Relations
- mem-_system
- mem-cli
