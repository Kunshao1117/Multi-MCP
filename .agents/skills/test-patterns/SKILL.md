---
name: test-patterns
description: >
  [Testing] Unit test scaffolding, API contract validation, and error boundary scenario library.
  Use when: 需要產生單元測試/API 契約驗證/異常場景測試/Mock 策略決策 的場景。
  DO NOT use when: E2E 瀏覽器視覺測試（用 browser-testing + test-automation-strategy）、效能測量（用 performance-audit）。
metadata:
  author: antigravity
  version: "5.2"
  origin: framework
  memory_awareness: read
  tool_scope: ["filesystem:read", "terminal"]
---

# Test Patterns — 測試模式庫

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

Check `_system` memory card for project-specific conventions first.

### Default Conventions (預設慣例)

- **Placement**: Co-located with source file
- **Naming**: `{filename}.test.ts` or `{filename}.spec.ts`
- **Runner**: Read from `_system` memory card tech stack section
- **Run command**: `npx jest {path}` or `npx vitest run {path}`

### Override Protocol (覆寫協定)

If `_system` memory card specifies `__tests__/` directory convention, follow that instead.

## 3. Error Scenario Checklist (異常場景清單)

### API Route Mandatory Scenarios (必測場景)

Every API route handler MUST be tested against:

| Scenario                                 | Expected Status | Description                                                                                    |
| ---------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------- |
| Valid request（正常請求）                | 200/201         | Happy path with correct payload（正確格式的正常請求）                                          |
| Missing required fields（缺少必填欄位）  | 400             | Payload missing required properties（缺少必填屬性）                                            |
| Invalid field types（欄位型別錯誤）      | 400             | Wrong data types in payload（傳入錯誤的資料型別）                                              |
| Unauthenticated（未登入）                | 401             | No auth token or expired token（無認證令牌或令牌過期）                                         |
| Unauthorized（無權限）                   | 403             | Valid token but insufficient permissions（令牌有效但權限不足）                                 |
| Resource not found（資源不存在）         | 404             | Request targets non-existent resource（請求不存在的資源）                                      |
| Duplicate creation（重複建立）           | 409             | Creating already-existing unique resource（建立已存在的唯一資源）                              |
| Server error isolation（伺服器錯誤隔離） | 500             | Simulate DB failure — response must NOT leak internals（模擬資料庫故障，回應不可洩漏內部細節） |

### Frontend Error Handling Scenarios (前端異常場景)

Verify these states when calling APIs from frontend:

| Scenario                       | Expected Behavior                                       |
| ------------------------------ | ------------------------------------------------------- |
| Network offline（網路離線）    | Show friendly "連線不穩定" message + retry button       |
| API timeout（API 逾時）        | Show loading indicator → timeout message → retry option |
| Auth expired (401)（認證過期） | Auto-redirect to login page                             |
| Forbidden (403)（無權限）      | Show "權限不足" message, no retry                       |
| Corrupted response（損壞回應） | Graceful fallback, not white screen of death            |

## 4. API Contract Validation (前後端契約驗證)

### Step 1: Identify the Contract

1. Locate backend Zod schema (or equivalent) for the target API route
2. Locate frontend fetch/axios call and its payload/response types

### Step 2: Cross-Validate

1. Compare field names: frontend vs backend → Flag mismatch
2. Compare field types: frontend sends vs backend expects → Flag mismatch
3. Compare required/optional: frontend omits backend-required field → Flag mismatch
4. Compare response shape: frontend expects vs backend returns → Flag mismatch

### Step 3: Report or Fix

- During `/03_build` → Fix immediately
- During `/08_audit` → Document under 「前後端串接缺口」

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

## 5.5 Mock Presence Gate (Mock 存在性閘門)

```
[MOCK GATE] Before finalizing ANY test file:
├── [SUDO] detected? → Skip mock check. Allow real network calls.
├── Test file contains external API calls (fetch/axios)?
│   ├── NO  → Proceed silently.
│   └── YES → Mock/MSW interceptor present?
│       ├── YES → Proceed silently.
│       └── NO  → [HALT] 「🔴 [TEST HALT] 偵測到外部 API 呼叫但無 Mock 攔截。」
│                 Auto-generate MSW handler. Re-validate.
└── Gate cleared.
```

## 6. Memory Card Integration (記憶卡整合)

When generating tests, cross-reference target module's memory card:

1. `## Key Decisions` → Tests MUST verify these decisions are upheld
2. `## Known Issues` → Tests MUST cover documented edge cases
3. `## Applicable Skills` → Load referenced skills for domain-specific constraints

## Constraints (限制與邊界)

- Scope: unit tests and contract validation ONLY
- E2E browser tests: `browser-testing` + `test-automation-strategy`
- Performance testing: NOT covered
- Test execution: via terminal `run_command`, NOT MCP tools
