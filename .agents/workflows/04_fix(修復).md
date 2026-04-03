---
description: Executes targeted bug fixes with a strict minimal-impact policy. Requires explicit visual diff authorization.
required_skills: [memory-ops, security-sre, test-patterns, impact-test-strategy, cross-lingual-guard]
memory_awareness: full
---

# [WORKFLOW: FIX (修復)]

> **Required Skills**: 見 YAML `required_skills` 欄位。

## 0. Memory Recall (記憶載入)
- Check the IDE-injected skill list for memory cards relevant to the target modules.
- Load relevant memory card SKILL.md files — match against `## Known Issues` (the fix may relate to a previously documented issue) and check `## Relations` for cascading impact.

## 1. Current State Constraint
- **Strict Pre-condition**: Use loaded memory skills' `## Tracked Files` (joined with project root) to navigate directly to relevant files. You may also query the failing process via terminal. DO NOT guess the architecture or file paths blindly.

## 1.5 Impact Analysis (影響分析 — 新增步驟)
- Execute `impact-test-strategy` skill § 1 Impact Analysis Flow:
  1. Map the target file(s) to their owning module(s) via memory cards
  2. Identify affected modules through Relations
  3. Classify risk level (High/Medium/Low)
- Include the impact report in the patch plan (§ 3)

## 2. Minimal Impact Principle
- Identify the exact root cause of the bug.
- You are STRICTLY FORBIDDEN from refactoring adjacent code or changing the overall architecture. Modify ONLY the precise lines necessary to resolve the issue.

## 3. Patch Plan Generation
- You MUST call `task_boundary` to enter `PLANNING` mode.
- Generate a Markdown Artifact named `implementation_plan.md` in **Traditional Chinese (繁體中文, zh-TW)**.
- **Structure**:
  1. 【故障根因白話文翻譯】(Plain text translation of the bug)
  2. 【影響分析】(Impact analysis from § 1.5 — risk level, affected modules)
  3. 【修改範圍】(Exact files to be touched)
  4. 【實體 Diff 對照】(Before / After code blocks for the Director to review)
  5. 【連帶影響評估】(Cascading impact analysis)

## 4. Authorization Gate & Execution
- Do NOT write to the file system yet.
- **Halt**: Call `notify_user` with `implementation_plan.md` in `PathsToReview` and prompt: `[防線鎖定] 修復補丁已擬定。請總監審閱實作計畫。若同意，請輸入 GO 核准寫入實體檔案。`
- Upon GO, you MUST call `task_boundary` to switch to `EXECUTION` mode and execute the fix to the physical file system.
- **Mandatory Distillation**: Immediately after writing the fix:
  1. Append the lesson to the affected memory skill's `## Known Issues` or `## Module Lessons`.
  2. Update the memory skill's frontmatter (`last_updated`, `staleness: 0`).
  3. **Regression Test Generation（回歸測試產生）**: Execute `impact-test-strategy` skill § 3 to auto-generate a regression test for this fix. The test must verify the bug does not recur.
  4. **Skill Distillation（技能萃取建議）**: If the root cause pattern represents a class of bugs that could recur across modules, and no existing framework or project skill covers this pattern, RECOMMEND creating a defensive project skill via `/12_skill_forge`.

// turbo
## 5. Automated Re-Verification Loop
- Once the fix is written and the lesson is documented, you MUST autonomously invoke the `/06_test` workflow to visually verify your patch. DO NOT wait for the Director's command.

## COMPLETION GATE（完成閘門 — 不可略過）
> Inherits: `.agents/workflows/_completion_gate.md`
- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Browser Gate)
- **Role**: `Worker` | 權限依安全閘門矩陣。
- **Memory Update**: After executing the fix, update all affected memory card SKILL.md files.
