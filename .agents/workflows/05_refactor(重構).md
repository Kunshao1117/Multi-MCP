---
description: Restructures code for performance/cleanliness without altering business logic. Enforces pre- and post-refactor automated testing.
required_skills: [memory-ops, code-quality]
memory_awareness: full
---

# [WORKFLOW: REFACTOR (重構)]

> **Required Skills**: Load `memory-ops` and `code-quality` skills before proceeding.

## 0. Memory Recall (記憶載入)
- Check the IDE-injected skill list for memory cards relevant to the target modules.
- Load relevant memory card SKILL.md files — check `## Relations` to ensure refactoring does not break dependent modules.

## 1. Tech-Stack Binding & Zero-Regression
- **Crucial Step**: Read `.agents/memory/_system/SKILL.md` to identify the correct testing framework (e.g., Jest, PyTest) and tech stack before proceeding.
- **Absolute Rule**: You MUST NOT change the external behavior or business logic of the target module.
- Generate and run automated Unit Tests (using the stack-appropriate CLI) to establish a baseline.

## 2. Refactoring Execution
- Optimize for Big-O performance, readability, and SOLID principles.
- Split files exceeding their thresholds as defined in the `code-quality` Skill.
- ALL newly generated docstrings MUST be in **Traditional Chinese (繁體中文)**.

## 3. QA Validation & Reporting
- Re-run the Unit Tests. They MUST pass 100%.
- Generate an Artifact detailing the performance gains.
- **Halt**: Output: `[系統鎖定] 重構完畢且通過單測基線。請總監審閱效能提升報告。`

## COMPLETION GATE（完成閘門 — 不可略過）
> Inherits: `.agents/workflows/_completion_gate.md`
- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Browser Gate)
- **Role**: `Worker Agent`. You operate under the Sandbox & Gate protocol.
- **Memory Update**: After refactoring, update affected memory cards' `## Tracked Files` (if files moved/renamed), `## Key Decisions` (if interfaces changed), and frontmatter.
