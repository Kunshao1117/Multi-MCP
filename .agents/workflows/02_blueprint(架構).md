---
description: Converts business requirements into strict software architecture, ER diagrams, and API routes. Generates dual-track memory.
required_skills: [memory-ops, tech-stack-protocol, cross-lingual-guard]
memory_awareness: full
---

# [WORKFLOW: BLUEPRINT (架構)]

> **Required Skills**: 見 YAML `required_skills` 欄位。

## 1. Context Retrieval
- Read the current state of `.agents/memory/_system/SKILL.md`. If it does not exist or the stack is `[UNDEFINED]`, halt and prompt the Director to finalize the tech stack first.

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
- Initialize the Memory Card System at `.agents/memory/`:
  1. Create `_system/SKILL.md` from tech stack decisions. Include runtime, framework, external_services, env_keys, config_files, and deploy info in Markdown sections.
  2. Create one `{module}/SKILL.md` per major functional module identified in the blueprint. Populate with standard sections: Tracked Files, Key Decisions, Known Issues, Module Lessons, Relations, Applicable Skills.
  3. Memory card descriptions MUST include Chinese keywords for Director instruction matching.
  4. Memory card frontmatter MUST include `last_updated`, `status`, and `staleness: 0`.
  5. Memory card granularity: each card SHOULD track no more than 8 files. Use nested directories to establish tree hierarchy (max depth 4). Layer 3-4 cards go inside their parent card's directory. Group shared decisions in parent cards.
  6. **Nesting Analysis**: Before creating cards, analyze module relationships. If module B's `scopePath` is a sub-path of module A's, create B inside A's directory. Follow the Nesting Decision Tree in `memory-ops` skill § 5.
  7. **Applicable Skills Population（適用技能填入）**: For each module memory card, analyse its characteristics (API? Frontend? Auth? Data?) and list the framework skills that govern operations on this module (e.g., `security-sre` for auth modules, `ui-ux-standards` for frontend modules).

## COMPLETION GATE（完成閘門 — 不可略過）
> Inherits: `.agents/workflows/_completion_gate.md`
- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Browser Gate)
- **Role**: `Writer/SRE` | 權限依安全閘門矩陣。