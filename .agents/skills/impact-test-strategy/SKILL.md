---
name: impact-test-strategy
description: >
  Change impact analysis, test scope orchestration, and regression test generation.
  Use when: 修改程式碼前需要評估影響範圍、決定測試範圍、
  或修復 bug 後需要產生回歸測試的場景。
metadata:
  author: antigravity
  version: "5.2"
  origin: framework
  memory_awareness: read
  tool_scope: ["filesystem:read"]
---

# Impact & Test Strategy — 影響與測試策略

> This skill teaches the Agent to analyze change impact BEFORE modifying code,
> determine the appropriate test scope, and generate regression tests AFTER fixing bugs.

## 1. Impact Analysis Flow (影響分析流程)

Execute this analysis BEFORE writing code modifications:
（修改程式碼之前執行此分析）

### Step 1: Map File → Module (檔案→模組映射)

```
Modified file identified?
├── Read .agents/memory/ — scan all memory cards' ## Tracked Files
├── Find which memory card(s) track this file
└── Result: "This file belongs to module {X}"
    └── If no memory card tracks this file → Flag as untracked, proceed with caution
```

### Step 2: Map Module → Affected Modules (模組→受影響模組)

```
Source module identified?
├── Read the source module's ## Relations section
├── List all modules that DEPEND ON the source module
│   └── These modules may break if the source module's interface changes
├── List all modules that the source module DEPENDS ON
│   └── Changes here should NOT affect dependents (unless interface changed)
└── Result: Affected module list + dependency direction
```

### Step 3: Risk Classification (風險分級)

| Risk Level | Criteria | Examples |
|-----------|----------|---------|
| 🔴 High | File is imported by 3+ modules, OR is a core utility/shared service | `utils.ts`, `auth-service.ts`, shared hooks |
| 🟡 Medium | File is internal to a module but affects module's public interface | Module's main export, API route handler |
| 🟢 Low | File is a leaf component used by only one parent | Single-use UI component, isolated helper |

### Step 4: Output Impact Report (輸出影響報告)

Include in `implementation_plan.md`:
```markdown
【影響分析】
- 修改檔案：{file path}
- 所屬模組：{module name}
- 風險等級：🔴/🟡/🟢
- 受影響模組：{list of affected modules}
- 建議測試範圍：{see § 2}
```

## 2. Test Scope Decision Tree (測試範圍決策樹)

Based on the impact analysis, determine which tests to run:
（根據影響分析結果，決定執行哪些測試）

```
What type of change is this?
├── Hotfix (單一模組內的快速修復)
│   └── Run: Source module's unit tests + Source module's E2E paths
│       → Fast feedback, minimal disruption
│
├── Cross-module change (跨模組修改)
│   └── Run: All affected modules' unit tests + Full E2E suite
│       → Broader coverage for cascading changes
│
├── Core utility refactor (核心工具重構)
│   └── Run: ALL unit tests + Full E2E suite
│       → Maximum coverage — core changes affect everything
│
├── UI-only change (純 UI 修改)
│   └── Run: E2E visual test for affected pages only
│       → No unit tests needed for pure presentation changes
│
└── Config / Environment change (設定/環境變更)
    └── Run: Full E2E suite (no unit tests)
        → Verify the application bootstraps correctly
```

### Execution Protocol (執行協定)

1. **Unit tests first** — Fast feedback loop（先跑單元測試，快速回饋）
2. **Fix unit test failures before proceeding to E2E**（修復單元測試失敗後再跑 E2E）
3. **E2E tests last** — Comprehensive validation（最後跑 E2E，全面驗證）

## 3. Regression Test Generator (回歸測試產生器)

After fixing a bug via `/04_fix`, generate a regression test:
（透過 `/04_fix` 修復 bug 後，產生回歸測試）

### Step 1: Analyze the Fix Diff (分析修復差異)

From the code diff, extract:
- **Root cause pattern**: What type of bug was it?（根因模式）
- **Trigger condition**: What input/state caused the bug?（觸發條件）
- **Expected behavior**: What should happen instead?（預期行為）

### Step 2: Select Regression Template (選擇回歸模板)

```
What type of bug was fixed?
├── Validation bypass (驗證繞過)
│   └── Template: "Send the exact invalid input that previously bypassed validation"
├── Null reference (空值引用)
│   └── Template: "Pass null/undefined for the field that caused the crash"
├── Race condition (競爭條件)
│   └── Template: "Simulate concurrent operations that previously conflicted"
├── Wrong status code (錯誤狀態碼)
│   └── Template: "Verify the exact HTTP status code for the scenario"
├── Missing data transformation (資料轉換遺漏)
│   └── Template: "Verify data shape matches expected contract"
└── UI state desync (UI 狀態失同步)
    └── Template: "Reproduce the exact user action sequence that caused the desync"
```

### Step 3: Write and Register (撰寫並註冊)

1. Write the regression test using `test-patterns` skill's § 1 decision tree for file placement
2. Name the test descriptively: `it('should not regress: {bug description}')`
3. Document in the module's memory card `## Module Lessons` with lesson ID

### Integration with /04_fix Completion Gate (與修復完成門的整合)

The Completion Gate SHOULD check:
- [ ] Regression test generated for the fixed bug
- [ ] Regression test passes
- [ ] Lesson documented in memory card

## Constraints (限制與邊界)

- Impact analysis uses **memory card Relations** as the primary data source
  （影響分析以記憶卡的關聯性為主要資料來源）
- If no memory cards exist, fall back to `grep_search` for import/require analysis
  （若無記憶卡，退回使用 grep 搜尋 import 語句）
- This skill does NOT execute tests — it determines WHICH tests to run
  （本技能不執行測試，只決定該跑哪些測試）
- Actual test execution is done via terminal `run_command`
  （實際測試執行透過終端機命令）

## References (參考資源)

- `references/regression-test-examples.md` — Common regression test patterns with code examples
