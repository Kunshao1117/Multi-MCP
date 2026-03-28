---
description: Actuates the Browser Agent to perform visual and functional tests on the UI without Director intervention.
required_skills: [test-automation-strategy, browser-testing]
memory_awareness: read
---

# [WORKFLOW: TEST (測試)]

> **Required Skills**: Load `test-automation-strategy` before proceeding.

## 1. Invocation & Autonomy
- This workflow can be called by the Director directly or autonomously invoked by other workflows (e.g., via the `// turbo` chain from `/03_build`).

## 2. Robotic QA & Visual Verification
- You MUST spawn the `browser_agent` to navigate to the application's local URL (e.g., `http://localhost:3000` or equivalent).
- Perform end-to-end (E2E) functional tests mimicking a real user: click buttons, fill forms, and observe state changes.

## 3. 測試授權與自動判斷
- You MUST call `task_boundary` to enter `VERIFICATION` mode before starting tests.
- As proof of work, you MUST capture screenshots (or video recordings) of the browser's final state or the successful UI changes.
- Generate a Markdown `walkthrough.md` Artifact embedding these visual assets alongside a summary of what was tested.

### 情境 A：測試通過 (Passed)
- **Halt**: Call `notify_user` with `walkthrough.md` in `PathsToReview` and output: `[視覺授權閘門] 測試與走查驗證執行完畢。請總監看圖審查成果。若 UI 與功能皆符合預期，請輸入 GO 放行。`

// turbo
### 情境 B：測試失敗 (Failed)
- **Automatic Failure Logging**: If the test fails or produces unexpected UI behavior, you MUST document the failure symptom into `.agents/logs/episodic_log.md` before doing anything else.
- **Autonomous Fixing Loop**: You MUST NOT wait for the Director to ask for a fix. You MUST autonomously invoke the `/04_fix` workflow to investigate and resolve the issue. Output: `[系統通報] 偵測到測試失敗，錯誤已寫入教訓庫。正在自動串聯 /04_fix 進行修復。`

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Browser Gate + Audit Trail)
- **Role**: `Reader Agent`. You are STRICTLY FORBIDDEN from modifying physical source code.
