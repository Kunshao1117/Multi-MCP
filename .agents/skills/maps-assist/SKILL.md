---
name: maps-assist
description: >
  [MCP: google-maps] Google Maps Platform code assist: documentation retrieval and query strategy.
  Use when: 需要 地圖功能/Maps API/地點/路線/地理編碼 的開發場景。
  DO NOT use when: 非地圖功能開發。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: none
  mcp_servers: [google-maps]
  tool_scope: ["mcp:google-maps"]
---

# Maps Assist (地圖 API 輔助)

## Trigger Conditions (觸發條件)

- Implementing Google Maps features (markers, routes, places, geocoding)
  （實作 Google 地圖功能：標記、路線、地點、地理編碼）
- Troubleshooting Maps API errors or migration
  （排除地圖 API 錯誤或版本遷移）

## Procedure (操作流程)

### Step 1: Load Instructions (載入指引 — MANDATORY FIRST)

**MUST call `retrieve-instructions` BEFORE any other gmp tool.**
（**必須**在使用任何地圖工具前先呼叫此工具）

This returns foundational context for effective search queries.
（此工具回傳有效搜尋查詢所需的基礎指引）

### Step 2: Search Documentation (搜尋文件)

Call `retrieve-google-maps-platform-docs` with:

- Specific, focused queries (e.g., "Advanced Markers styling" NOT "maps")
  （精確查詢，如「進階標記樣式」而非「地圖」）
- Include `search_context` array for product/feature names
  （在搜尋上下文中加入產品/功能名稱）

### Step 3: Apply Results (套用結果)

- Use retrieved code samples as reference, adapt to project tech stack
  （以取得的程式碼範例為參考，適配專案技術堆疊）
- Verify API version matches project requirements
  （確認 API 版本符合專案需求）

## Constraints (約束)

- **Instruction-First Rule**: Calling docs without instructions = poor query quality = wasted context
  （未載入指引就查文件 = 查詢品質差 = 浪費上下文）
- **Read-Only**: This MCP can only retrieve information, NOT create projects or manage API keys
  （此 MCP 只能檢索資訊，無法建立專案或管理 API 金鑰）
- **Context Budget**: Retrieved docs consume context window. Use focused queries to minimize waste
  （文件片段會消耗上下文空間，使用精確查詢以減少浪費）

## Done When (驗證標準)

- Relevant documentation retrieved for the specific Maps feature
- Code implementation follows retrieved best practices
