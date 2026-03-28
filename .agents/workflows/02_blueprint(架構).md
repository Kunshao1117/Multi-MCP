---
description: Converts business requirements into strict software architecture, ER diagrams, and API routes. Generates dual-track memory.
required_skills: [memory-ops, tech-stack-protocol]
memory_awareness: full
---

# [WORKFLOW: BLUEPRINT (架構)]

> **Required Skills**: Load `memory-ops` and `tech-stack-protocol` skills before proceeding.

## 1. Context Retrieval
- Read the current state of `mem-_system/SKILL.md`. If it does not exist or the stack is `[UNDEFINED]`, halt and prompt the Director to finalize the tech stack first.

## 2. Topology Generation
- Map out the exact Entity-Relationship (ER) logic for databases.
- Define explicit RESTful or GraphQL API endpoints, including request/response JSON payloads.
- Define the frontend component tree structure.

## 3. Dual-Track Output Mandate (CRITICAL)
You MUST execute BOTH of the following actions synchronously:

**Track A: Human-Readable Artifact (For Director)**
- You MUST call `task_boundary` to enter `PLANNING` mode.
- Generate a comprehensive Markdown Artifact named `implementation_plan.md` (representing the Blueprint).
- **Language**: STRICTLY **Traditional Chinese (繁體中文, zh-TW)**.
- Must include visual representations (e.g., Mermaid.js diagrams for ER mapping).
- **Halt**: Call `notify_user` with `implementation_plan.md` in `PathsToReview` and append: `[系統鎖定] 架構藍圖規劃已完成。請總監審閱。若確認無誤，請輸入 /build 授權實體建設。`

**Track B: Machine-Readable Memory (Memory Skill System)**
- Initialize the Memory Skill System at `.agents/skills/`:
  1. Create `mem-_system/SKILL.md` from tech stack decisions. Include runtime, framework, external_services, env_keys, config_files, and deploy info in Markdown sections.
  2. Create one `mem-{module}/SKILL.md` per major functional module identified in the blueprint. Populate with standard sections: Tracked Files, Key Decisions, Known Issues, Module Lessons, Relations.
  3. Memory skill descriptions MUST include Chinese keywords for Director instruction matching.
  4. Memory skill frontmatter MUST include `last_updated`, `status`, and `staleness: 0`.

## COMPLETION GATE（完成閘門 — 不可略過）
> Inherits: `.agents/workflows/_completion_gate.md`
- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Browser Gate + Audit Trail)
- **Role**: `Writer/SRE Agent`. You are authorized to write structural/log files or execute specific system commands.
