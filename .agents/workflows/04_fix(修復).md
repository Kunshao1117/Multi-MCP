---
description: Executes targeted bug fixes with a strict minimal-impact policy. Requires explicit visual diff authorization.
required_skills: [memory-ops, security-sre]
memory_awareness: full
---

# [WORKFLOW: FIX (修復)]

> **Required Skills**: Load `memory-ops` and `security-sre` skills before proceeding.

## 0. Memory Recall (記憶載入)
- Check the IDE-injected skill list for memory cards relevant to the target modules.
- Load relevant memory card SKILL.md files — match against `## Known Issues` (the fix may relate to a previously documented issue) and check `## Relations` for cascading impact.

## 1. Current State Constraint
- **Strict Pre-condition**: Use loaded memory skills' `## Tracked Files` (joined with project root) to navigate directly to relevant files. You may also query the failing process via terminal. DO NOT guess the architecture or file paths blindly.

## 2. Minimal Impact Principle
- Identify the exact root cause of the bug.
- You are STRICTLY FORBIDDEN from refactoring adjacent code or changing the overall architecture. Modify ONLY the precise lines necessary to resolve the issue.

## 3. Patch Plan Generation
- You MUST call `task_boundary` to enter `PLANNING` mode.
- Generate a Markdown Artifact named `implementation_plan.md` in **Traditional Chinese (繁體中文, zh-TW)**.
- **Structure**:
  1. 【故障根因白話文翻譯】(Plain text translation of the bug)
  2. 【修改範圍】(Exact files to be touched)
  3. 【實體 Diff 對照】(Before / After code blocks for the Director to review)
  4. 【連帶影響評估】(Cascading impact analysis)

## 4. Authorization Gate & Execution
- Do NOT write to the file system yet.
- **Halt**: Call `notify_user` with `implementation_plan.md` in `PathsToReview` and prompt: `[防線鎖定] 修復補丁已擬定。請總監審閱實作計畫。若同意，請輸入 GO 核准寫入實體檔案。`
- Upon GO, you MUST call `task_boundary` to switch to `EXECUTION` mode and execute the fix to the physical file system.
- **Mandatory Distillation**: Immediately after writing the fix:
  1. Append the lesson to the affected memory skill's `## Known Issues` or `## Module Lessons`.
  2. Update the memory skill's frontmatter (`last_updated`, `staleness: 0`).

// turbo
## 5. Automated Re-Verification Loop
- Once the fix is written and the lesson is documented, you MUST autonomously invoke the `/06_test` workflow to visually verify your patch. DO NOT wait for the Director's command.

## COMPLETION GATE（完成閘門 — 不可略過）
> Inherits: `.agents/workflows/_completion_gate.md`
- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Browser Gate)
- **Role**: `Worker Agent`. You operate under the Sandbox & Gate protocol.
- **Memory Update**: After executing the fix, update all affected memory card SKILL.md files.
