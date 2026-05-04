---
description: 第一階段（共 2 階段）— 診斷缺陷、分析影響範圍，產出全繁中的實作計畫供總監審閱。不寫入磁碟。
required_skills: [memory-ops, impact-test-strategy]
memory_awareness: full
---

# [WORKFLOW: FIX PLAN (修復計畫)]


## 0. Memory Recall

> [LOAD SKILL] Before reading memory, you MUST consult:
> `view_file .agents/skills/memory-ops/SKILL.md`

- Check the IDE-injected skill list for memory cards relevant to the target modules.
- Load relevant memory card SKILL.md files — match against `## Known Issues` (the fix may relate to a previously documented issue) and check `## Relations` for cascading impact.

## 1. Current State Constraint
- [CONSTRAINT] Use loaded memory skills' `## Tracked Files` to navigate directly to relevant files.
- [FORBIDDEN] DO NOT guess the architecture or file paths blindly.

> [LOAD SKILL] 影響分析執行前，必須讀取：
> `view_file .agents/skills/impact-test-strategy/SKILL.md`

## 1.5 Impact Analysis
- Execute `impact-test-strategy` skill § 1 Impact Analysis Flow:
  1. Map the target file(s) to their owning module(s) via memory cards.
  2. Identify affected modules through Relations.
  3. Classify risk level (High/Medium/Low).
- [ASSERT] Include the impact report in the patch plan (§ 3).

## 2. Minimal Impact Principle
- Identify the exact root cause of the bug.
- [FORBIDDEN] You are STRICTLY FORBIDDEN from refactoring adjacent code or changing the overall architecture. Modify ONLY the precise lines necessary to resolve the issue.

## 3. Patch Plan Generation
- [ASSERT] You MUST call `task_boundary` to enter `PLANNING` mode.
- [EXECUTE] Generate a Markdown Artifact named `implementation_plan.md`.
- **Structure**:
  1. 【故障根因白話文翻譯】
  2. 【影響分析】(Risk level and affected modules from § 1.5)
  3. 【修改範圍】(Exact files to be touched)
  4. 【實作邏輯對照】(Before / After diff)
     [CONSTRAINT: DUAL-AUDIENCE ARCHITECTURE]
     - Code syntax, function/class names, and system control tags (e.g. `[EXECUTE]`, `[CONSTRAINT]`) MAY remain in English.
     - ALL surrounding documentation, business logic descriptions, and transition text MUST be 100% Traditional Chinese. Zero English prose visible to the Director.
  5. 【連帶影響評估】

## 4. Halt & Eject
- [HALT] This workflow has NO permission to write to the physical file system.
- [EXECUTE] Call `notify_user` with `implementation_plan.md` in `PathsToReview` and output:
  `[修復計畫擬定] 請總監審閱上方全中文介面預覽。若確認修復方向無誤，請觸發 @[/04-2_fix_execute] 授權進入實體覆寫程序。`

---

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Reader` | 純規劃，禁止任何磁碟寫入。

`...EOF... — Agent inference context physically terminates here. No file writes may occur beyond this line.`
