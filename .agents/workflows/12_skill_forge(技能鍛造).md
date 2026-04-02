---
description: Creates new project-specific skills by distilling reusable patterns from audit findings, debugging methodologies, or Director directives.
required_skills: [skill-factory, memory-ops]
memory_awareness: full
skill_generation: true
---

# [WORKFLOW: SKILL FORGE (技能鍛造)]

> **Required Skills**: Load `skill-factory` skill before proceeding. Load `memory-ops` if memory cards need updating.

## 1. Trigger Conditions (觸發條件)

This workflow is triggered by one of the following:
- Director explicitly requests a new project skill（總監明確指示建立新技能）
- `/08_audit` Phase G recommends a new skill based on pattern detection（健檢偵測到跨模組重複模式）
- `/04_fix` or `/07_debug` recommends distilling a methodology（修復/除錯後發現可萃取方法論）

## 2. Skill Design Planning

- You MUST call `task_boundary` to enter `PLANNING` mode.
- Load the `skill-factory` skill and read its `references/skill-template.md` for the standard format.
- Generate a draft `implementation_plan.md` containing:
  1. 【技能名稱與描述】(Proposed name in kebab-case + functional description)
  2. 【觸發場景】(When should this skill be loaded)
  3. 【操作步驟草稿】(Draft instructions)
  4. 【參考資源需求】(Whether references/ subdirectory is needed)

## 3. Director Review Gate

- **Halt**: Call `notify_user` with `implementation_plan.md` in `PathsToReview` and prompt:
  `[技能鍛造閘門] 專案衍生技能草稿已完成。請總監審閱。若同意，請輸入 GO 授權建立。`
- Wait for Director's GO signal.

## 4. Skill Generation (Execution)

Upon approval:
1. Call `task_boundary` to switch to `EXECUTION` mode.
2. Create the skill directory under `.agents/project_skills/{skill-name}/`.
3. Write `SKILL.md` following the `skill-factory` template. Frontmatter MUST include:
   ```yaml
   metadata:
     author: antigravity
     version: "1.0"
     origin: project
     memory_awareness: none|read|full
   ```
4. Create `references/` subdirectory if the skill requires L3 resources.
5. Update `.agents/skills/_index.md` to register the new project skill with keywords.

## 5. Verification

- Read back the generated `SKILL.md` and validate format compliance.
- Confirm the symlink `.agents/skills/_project` correctly resolves to the new skill's parent directory.

## COMPLETION GATE（完成閘門 — 不可略過）
> Inherits: `.agents/workflows/_completion_gate.md`
- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Browser Gate)
- **Role**: `Worker Agent`. You operate under the Sandbox & Gate protocol.
- **Project Skills Write**: Authorized to create and modify files within `.agents/project_skills/`.
