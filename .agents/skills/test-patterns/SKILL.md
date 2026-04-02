---
name: test-patterns
description: >
  Unit test scaffolding, API contract validation, and error boundary scenario library.
  Use when: 寫完功能需要自動產生測試、前後端對接驗證、
  或任何涉及 單元測試/契約測試/異常場景/Mock策略 的場景。
metadata:
  author: antigravity
  version: "5.2"
  origin: framework
  memory_awareness: read
  tool_scope: ["filesystem:read", "terminal"]
---

# Test Patterns — 測試模式庫

> This skill extends Core Mandate §11 (Cross-Cutting Quality Constraints) — Testing section.
> It provides concrete test decision trees, templates, and scenario libraries.
> Principle-level descriptions live in Core Mandate; this skill focuses on implementation specifics.

## 1. Test Decision Tree (測試決策樹)

When you have finished writing code, determine the test type:
（寫完程式碼後，依據以下決策樹決定測試類型）

```
Finished writing code?
├── Utility / Service functions (計算、轉換、驗證)
│   └── ✅ Unit Test — MUST write
│       → Use template: references/utility-test-template.md
├── API route handler (路由處理器)
│   └── ✅ Unit Test + Error Scenarios — MUST write
│       → Use template: references/api-route-test-template.md
│       → Apply § 3 Error Scenario Checklist
├── State management logic (Hook, Store, State Machine)
│   └── ✅ Unit Test — MUST write
│       → Use template: references/hook-test-template.md
├── Pure UI component (僅樣式/佈局，無邏輯)
│   └── ⏭️ SKIP — covered by E2E visual test (/06_test)
├── Config / Declarative routes (設定檔/宣告式路由)
│   └── ⏭️ SKIP — no testable logic
└── Database model / Schema definition
    └── ⏭️ SKIP — verified by migration validation (supabase-ops)
```

## 2. Test File Conventions (測試檔案慣例)

Before writing tests, check `_system` memory card for project-specific conventions.
（撰寫測試前，先檢查系統記憶卡的專案慣例）

### Default Conventions (預設慣例)
- **Placement**: Co-located with source file（與原始檔同目錄）
- **Naming**: `{filename}.test.ts` or `{filename}.spec.ts`
- **Runner**: Read from `_system` memory card's tech stack section（從系統記憶卡讀取測試框架）
- **Run command**: `npx jest {path}` or `npx vitest run {path}`（依專案而定）

### Override Protocol (覆寫協定)
If `_system` memory card specifies `__tests__/` directory convention, follow that instead.
（若系統記憶卡指定使用 `__tests__/` 目錄，則遵循該慣例）

## 3. Error Scenario Checklist (異常場景清單)

### API Route Mandatory Scenarios (API 路由必測場景)

Every API route handler MUST be tested against these scenarios:
（每個 API 路由處理器必須測試以下場景）

| Scenario | Expected Status | Description |
|----------|----------------|-------------|
| Valid request（正常請求） | 200/201 | Happy path with correct payload（正確格式的正常請求） |
| Missing required fields（缺少必填欄位） | 400 | Payload missing required properties（缺少必填屬性） |
| Invalid field types（欄位型別錯誤） | 400 | Wrong data types in payload（傳入錯誤的資料型別） |
| Unauthenticated（未登入） | 401 | No auth token or expired token（無認證令牌或令牌過期） |
| Unauthorized（無權限） | 403 | Valid token but insufficient permissions（令牌有效但權限不足） |
| Resource not found（資源不存在） | 404 | Request targets non-existent resource（請求不存在的資源） |
| Duplicate creation（重複建立） | 409 | Creating already-existing unique resource（建立已存在的唯一資源） |
| Server error isolation（伺服器錯誤隔離） | 500 | Simulate DB failure — response must NOT leak internals（模擬資料庫故障，回應不可洩漏內部細節） |

### Frontend Error Handling Scenarios (前端異常場景)

When writing frontend code that calls APIs, verify these states:
（撰寫呼叫 API 的前端程式碼時，驗證以下狀態）

| Scenario | Expected Behavior |
|----------|-------------------|
| Network offline（網路離線） | Show friendly "連線不穩定" message + retry button |
| API timeout（API 逾時） | Show loading indicator → timeout message → retry option |
| Auth expired (401)（認證過期） | Auto-redirect to login page |
| Forbidden (403)（無權限） | Show "權限不足" message, no retry |
| Corrupted response（損壞回應） | Graceful fallback, not white screen of death |

## 4. API Contract Validation (前後端契約驗證)

When building features that span frontend and backend:
（建構跨前後端的功能時）

### Step 1: Identify the Contract (識別契約)
- Locate the backend Zod schema (or equivalent validator) for the target API route
- Locate the frontend fetch/axios call and its expected payload/response types

### Step 2: Cross-Validate (交叉驗證)
- Compare field names: frontend `{ name, email }` vs backend `{ userName, emailAddress }` → Flag mismatch
- Compare field types: frontend sends `string` but backend expects `number` → Flag mismatch
- Compare required/optional: frontend omits a field that backend requires → Flag mismatch
- Compare response shape: frontend expects `{ data: [...] }` but backend returns `[...]` → Flag mismatch

### Step 3: Report or Fix (報告或修復)
- If during `/03_build`: Fix immediately before proceeding
- If during `/08_audit`: Document in audit report under "前後端串接缺口"

## 5. Mock Strategy Decision Tree (Mock 策略決策樹)

```
What are you mocking?
├── External API calls (fetch/axios to third-party)
│   └── Use MSW (Mock Service Worker) or fetch mock
│       → Intercept at network level, not at module level
├── Database operations (DB read/write)
│   └── Use repository pattern mock
│       → Mock the repository/service layer, not the DB client
├── File system operations (讀寫檔案)
│   └── Use memfs or temp directory
│       → Never mock fs module directly
├── Time-dependent logic (時間相關)
│   └── Use fake timers (jest.useFakeTimers)
│       → Control Date.now() and setTimeout
└── Environment variables (環境變數)
    └── Use process.env override in test setup
        → Restore original values in afterEach
```

## 6. Memory Card Integration (記憶卡整合)

When generating tests, cross-reference the target module's memory card:
（產生測試時，交叉參照目標模組的記憶卡）

1. Read `## Key Decisions` — tests should verify these decisions are upheld
   （測試應驗證關鍵決策仍被遵守）
2. Read `## Known Issues` — tests should cover documented edge cases
   （測試應涵蓋已記錄的邊界情況）
3. Read `## Applicable Skills` — load referenced skills for domain-specific test constraints
   （載入引用的技能以獲取領域特定的測試約束）

## Constraints (限制與邊界)

- This skill covers **unit tests and contract validation** only
  （本技能僅涵蓋單元測試和契約驗證）
- E2E browser tests are covered by `browser-testing` + `test-automation-strategy`
  （瀏覽器端對端測試由其他技能負責）
- Performance testing is NOT covered — deferred to future `performance-baseline` skill
  （效能測試不在範圍內）
- Test execution is done via terminal `run_command`, NOT via MCP tools
  （測試執行透過終端機命令，非 MCP 工具）
