---
name: test-automation-strategy
description: >
  [Testing] DOM element interaction patterns, selector strategy, and auto-fix feedback loops.
  Use when: 需要 DOM 選擇器策略（data-testid/aria-label 選擇）、E2E 測試的自動修復迴圈、或繁體中文 UI 字串斷言 的場景。
  DO NOT use when: 啟動或委派 browser_subagent（用 browser-testing）、寫單元測試程式碼（用 test-patterns）。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: none
  tool_scope: ["filesystem:read", "browser"]
---

# [SKILL: TEST AUTOMATION STRATEGY]

## 1. Browser Agent Orchestration (視覺化測試)

- **Visual Validation**: DO NOT rely solely on CLI tests. You MUST spawn the `browser_subagent` to visually verify UI behaviors resulting from your code modifications.
- **Server Warmup**: Always ensure the local server is running and fully booted (`npm run dev` or equivalent) before triggering the browser_subagent.
- **Artifact Proof**: After clicking elements or submitting forms, capture the final successful DOM state or screenshot and embed it into the `walkthrough.md` Artifact.

## 2. DOM Selection Patterns

```
[DOM SELECTOR GATE] For EVERY E2E DOM interaction:
├── Element has data-testid attribute?
│   ├── YES → Use data-testid. Proceed silently.
│   └── NO  → Element has aria-label or id?
│       ├── YES → Use aria-label/id. Proceed silently.
│       └── NO  → [HALT] 「🟡 [DOM WARN] 目標元素缺少穩定選擇器。建議新增 data-testid。」
│                 Proceed with text content fallback, but LOG warning.
└── FORBIDDEN: CSS class selectors (.btn-primary, .card-header) for test interactions.
```

## 3. Feedback Loop & Auto-Fix

- If a visual test fails (e.g., button is obscured, route returns 404), DO NOT halt and ask the Director for permission to fix.
- Log the symptom to the affected module's memory card `## Known Issues`.
- Automatically invoke `/04_fix(修復)` to rectify the codebase based on the DOM error, then retry the test workflow.

## 4. Traditional Chinese UI Matching

- When testing error messages or dialog cues, ensure assertions are verifying against Traditional Chinese (zh-TW) strings as mandated by the project style guide.
