---
name: test-automation-strategy
description: Testing heuristics, E2E Browser Agent orchestration, and strict DOM element interaction patterns.
---

# [SKILL: TEST AUTOMATION STRATEGY]

## 1. Browser Agent Orchestration (視覺化測試)
- **Visual Validation**: DO NOT rely solely on CLI tests. You MUST spawn the `browser_subagent` to visually verify UI behaviors resulting from your code modifications.
- **Server Warmup**: Always ensure the local server is running and fully booted (`npm run dev` or equivalent) before triggering the browser_subagent.
- **Artifact Proof**: After clicking elements or submitting forms, capture the final successful DOM state or screenshot and embed it into the `walkthrough.md` Artifact.

## 2. DOM Selection Patterns
- **Preference Order**: `data-testid` > `aria-label` > `id` > `text content` > CSS Path.
- Avoid fragile CSS class selectors when clicking elements to prevent test breakage.

## 3. Feedback Loop & Auto-Fix
- If a visual test fails (e.g., button is obscured, route returns 404), DO NOT halt and ask the Director for permission to fix.
- Log the symptom to `.agents/logs/episodic_log.md`.
- Automatically invoke `/04_fix(修復)` to rectify the codebase based on the DOM error, then retry the test workflow.

## 4. Traditional Chinese UI Matching
- When testing error messages or dialog cues, ensure assertions are verifying against Traditional Chinese (zh-TW) strings as mandated by the project style guide.
