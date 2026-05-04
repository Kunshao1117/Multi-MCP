---
name: context7-docs
description: >
  [MCP: context7] 即時框架文件查詢食譜：解析框架庫 ID、查詢最新官方文件、版本指定查詢。
  MCP Server: context7
  Use when: 需要 即時文件查詢/框架 API 確認/Next.js/React/Payload CMS 文件 的場景。
  DO NOT use when: 不確定框架名稱時先用搜尋引擎、非即時文件查詢需求。
metadata:
  author: antigravity
  version: "5.3"
  origin: framework
  memory_awareness: none
  mcp_servers: [context7]
  tool_scope: ["mcp:context7"]
---

# Context7 Docs — Live Documentation Query Recipes

## Trigger Conditions (觸發條件)

- Uncertainty about a framework API during coding
  （編碼時對框架 API 不確定）
- Need to verify if an API is deprecated or changed in the latest version
  （需確認 API 是否在最新版本中廢棄或變更）
- `/03_build` or `/04_fix` encounters framework-specific issues
  （建構或修復時遇到框架特定問題）
- Director asks about framework best practices
  （總監詢問框架最佳實踐）

## Recipe 1: Framework Documentation Query (框架文件查詢)

### Step 1: Resolve Library ID (解析庫 ID)

1. Call `resolve-library-id` — **必須同時傳入兩個參數**：
   - `libraryName`: 框架/套件名稱，如 `"nextjs"`, `"react"`, `"payloadcms"`
   - `query`: 描述你要做什麼，如 `"Next.js framework"`, `"React UI library"`
   - Returns: Library ID（格式 `/org/project`，如 `/websites/nextjs`）
2. If multiple results returned, select based on:
   - Name match > Source Reputation (High > Medium) > Benchmark Score > Code Snippet count

### Step 2: Query Documentation (查詢文件)

1. Call `query-docs` — **必須同時傳入兩個參數**：
   - `libraryId`: 從 Step 1 取得的 ID（如 `/websites/nextjs`）
   - `query`: 具體的技術問題（如 `"App Router server components data fetching"`）
   - Use specific, targeted queries for best results
   - ✅ Good: `"App Router server components data fetching"`
   - ❌ Bad: `"how does Next.js work"`
2. Results return relevant documentation snippets with source links

### Common Query Patterns (常見查詢模式)

| 框架         | 常見查詢                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------- |
| Next.js      | `"App Router metadata API"`, `"server actions form handling"`, `"middleware redirect"`    |
| React        | `"useOptimistic hook"`, `"server components vs client components"`, `"suspense boundary"` |
| Payload CMS  | `"collection hooks afterChange"`, `"access control functions"`, `"local API usage"`       |
| Tailwind CSS | `"arbitrary values"`, `"dark mode configuration"`, `"responsive breakpoints"`             |

## Recipe 2: Version-Specific Query (版本指定查詢)

When the project uses a specific framework version:
（當專案使用特定框架版本時）

1. Check `package.json` for the exact version（檢查 package.json 確認版本）
2. Include version info in the query context
3. Cross-reference results with the project's locked tech stack（交叉比對技術堆疊）

## Gotchas (踩坑點)

- **Both parameters are REQUIRED**: `resolve-library-id` and `query-docs` each require two parameters. Missing one causes `invalid_type` error（兩個參數都必填，缺一會報錯）
- **`libraryId` format**: Must be `/org/project` format (e.g., `/websites/nextjs`), NOT package name（必須是 `/org/project` 格式，不是套件名稱）
- Context7 queries the **latest** documentation — if your project uses an older version, verify API compatibility（查詢最新文件，注意版本相容性）
- Use specific queries, not broad questions — narrower queries produce better results（用具體查詢，非籠統問題）
- If `resolve-library-id` returns no results, try alternative names (e.g., `"next"` vs `"nextjs"`）
- Documentation results are snapshots — for critical decisions, verify against the actual source（關鍵決策請驗證原始文件）
- **每個問題最多呼叫 3 次** — 若 3 次內找不到，使用已有的最佳結果（API 限制）

## Integration with Workflows (工作流整合)

| 工作流      | 使用場景                        |
| ----------- | ------------------------------- |
| `/03_build` | 查詢框架 API 用法以正確實作功能 |
| `/04_fix`   | 查詢 API 變更以確認修復方向     |
| `/07_debug` | 查詢已知問題和解決方案          |
| `/08_audit` | 查詢最佳實踐以評估程式碼品質    |
