---
description: 啟動瀏覽器代理，在無需總監介入的情況下對 UI 執行視覺與功能性測試。
required_skills:
  [test-automation-strategy, browser-testing, a11y-testing, trunk-ops]
memory_awareness: read
---

# [WORKFLOW: TEST (測試)]


## 1. Invocation & Autonomy

- This workflow can be called by the Director directly or autonomously invoked by other workflows (e.g., via the `// turbo` chain from `/03_build`).

## 2. Robotic QA & Visual Verification

> [LOAD SKILL] 啟動瀏覽器測試前，必須讀取：
> 1. `view_file .agents/skills/browser-testing/SKILL.md`
> 2. `view_file .agents/skills/test-automation-strategy/SKILL.md`

- You MUST spawn the `browser_agent` for E2E visual testing.

[TEST OUTPUT GATE] 根據結果執行單一路徑：
- IF (全部通過): 印出「✅ E2E 測試全數通過 ({pass_count}/{total_count})」並產出含截圖的 walkthrough。
- IF (包含失敗): 印出「🔴 [TEST FAIL] {test_name}: {error_summary}」，並記錄至記憶卡 ## Known Issues，自動串聯 /04_fix。
- CONSTRAINT: 錯誤訊息最多 5 行。不輸出冗長日誌。

## 2.5 Accessibility Scan (無障礙掃描 — 新增步驟)

> [LOAD SKILL] 執行無障礙掃描前，必須讀取：
> `view_file .agents/skills/a11y-testing/SKILL.md`

- After visual testing, execute `a11y-testing` skill § 1 Scan Flow on each tested page.
- Include accessibility scan results in the walkthrough artifact.
- If critical a11y violations found → document and trigger `/04_fix` for remediation.

## 3. 測試授權與自動判斷

- You MUST call `task_boundary` to enter `VERIFICATION` mode before starting tests.
- As proof of work, you MUST capture screenshots (or video recordings) of the browser's final state or the successful UI changes.
- Generate a Markdown `walkthrough.md` Artifact embedding these visual assets alongside a summary of what was tested.

### 情境 A：測試通過 (Passed)

- **Halt**: Call `notify_user` with `walkthrough.md` in `PathsToReview` and output: `[視覺授權閘門] 測試與走查驗證執行完畢。請總監看圖審查成果。若 UI 與功能皆符合預期，請輸入 GO 放行。`

// turbo

### 情境 B：測試失敗 (Failed)

- **Automatic Failure Logging**: If the test fails or produces unexpected UI behavior, you MUST document the failure symptom into the affected module's memory card `## Known Issues` before doing anything else.
- **Autonomous Fixing Loop**: You MUST NOT wait for the Director to ask for a fix. You MUST autonomously invoke the `/04_fix` workflow to investigate and resolve the issue. Output: `[系統通報] 偵測到測試失敗，錯誤已寫入模組記憶。正在自動串聯 /04_fix 進行修復。`

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Reader/Memory` | Permissions based on the security gate matrix。記憶寫入限於記錄測試失敗。
