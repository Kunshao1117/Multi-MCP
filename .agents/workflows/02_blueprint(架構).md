---
description: 將商業需求轉化為嚴謹的軟體架構、ER 圖與 API 路由。同步建立雙軌記憶系統。
required_skills: [memory-ops, tech-stack-protocol]
memory_awareness: full
---

# [WORKFLOW: BLUEPRINT (架構)]


> [LOAD SKILL] Before executing §1, you MUST read:
> 1. `view_file .agents/skills/memory-ops/SKILL.md`
> 2. `view_file .agents/skills/tech-stack-protocol/SKILL.md`
> 3. `view_file .agents/skills/memory-arch/SKILL.md`

## 1. Context Retrieval

- Read the current state of `.agents/memory/_system/SKILL.md`. If it does not exist or the stack is `[UNDEFINED]`, halt and prompt the Director to finalize the tech stack first.

## 1.5 Real-Time Grounding (Zero-Trust Retrieval)

- [ASSERT] Do NOT rely solely on internal training weights for external frameworks and APIs.
- Identify the exact major versions of the target tech stack from `_system/SKILL.md`.
- [EXECUTE] You MUST execute an external retrieval step (e.g., `search_web` or `context7-docs`) to verify the latest 2026 best practices, breaking changes, or optimal architecture patterns for the chosen stack.
- Append the current year (e.g., "2026") to the search query if the framework version is ambiguous.

## 2. Topology Generation

[STRUCTURE GATE] Topology output validation:
- IF ([SUDO] detected in Director prompt): Allow freeform markdown. Skip structure validation.
- ELSE IF (Missing ER diagram, API endpoint list, or component tree):
  - Self-generate the missing structures internally before proceeding. Do NOT output incomplete blueprints.
- ELSE: Proceed silently.

## 3. Dual-Track Output Mandate (CRITICAL)

You MUST execute BOTH of the following actions synchronously:

**Track A: Human-Readable Artifact (For Director)**

- You MUST call `task_boundary` to enter `PLANNING` mode.
- Generate a comprehensive Markdown Artifact named `implementation_plan.md` (representing the Blueprint).
- **Language**: STRICTLY **Traditional Chinese (繁體中文, zh-TW)**.
- Must include visual representations (e.g., Mermaid.js diagrams for ER mapping).
- **Halt**: Call `notify_user` with `implementation_plan.md` in `PathsToReview` and append exactly: `[系統鎖定] 架構藍圖規劃已完成。請總監審閱。若確認無誤，請輸入 /build 授權實體建設。`

**Track B: Machine-Readable Memory (Memory Skill System)**

- Initialize the Memory Card System at `.agents/memory/`:
  1. Create `_system/SKILL.md` from tech stack decisions. Include runtime, framework, external_services, env_keys, config_files, and deploy info.
  2. Create one `{module}/SKILL.md` per major functional module. Populate standard sections: Tracked Files, Key Decisions, Known Issues, Module Lessons, Relations, Applicable Skills.
  3. Memory card descriptions MUST include Traditional Chinese keywords for Director instruction matching.
  4. Memory card frontmatter MUST include `last_updated`, `status`, and `staleness: 0`.
  5. Hierarchy: Follow `memory-arch` nesting guidelines (max depth 4, child paths placed inside parent directories).
  6. Applicable Skills: For each module memory card, analyze its characteristics (e.g., API, Auth, UI) and list the framework skills that govern it (e.g., `security-sre`, `ui-ux-standards`).

## COMPLETION GATE（完成閘門 — 不可略過）

> Inherits: `.agents/workflows/_completion_gate.md`

- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Writer/SRE` | Permissions based on the security gate matrix。
