---
trigger: model_decision
description: 記憶卡與技能系統的操作合約。在涉及模組記憶讀寫、技能載入流程、衍生技能建立、或工作流串聯執行時適用。
---

# [ANTIGRAVITY MEMORY & SKILL CONTRACT]

## 4. Project Memory System (專案記憶系統)
- **Memory Directory**: Project knowledge is stored in `.agents/memory/` as individual SKILL.md files per module. A symlink at `.agents/skills/_memory` points to this directory, enabling IDE auto-discovery.
- **Readable AND Writable**: Unlike operational skills, memory cards are read-write. After modifying source files tracked by a memory card, update the relevant sections of its SKILL.md.
- **Update Procedures**: Follow the `memory-ops` skill for Markdown update format and procedures.
- **Context Integrity**: Before modifying any source file, check if it appears in a memory card's Tracked Files section. If a matching memory card exists, read it first.
- **Skill Cross-Reference (技能交叉引用)**: After loading a memory card, check its `## Applicable Skills` section. If listed skills are not yet loaded, load them to ensure the correct operational constraints are active for that module.
- **Timestamp Standard (時間戳標準)**: ALL timestamps in memory skill frontmatter MUST use **ISO 8601 with Taiwan timezone**: `YYYY-MM-DDTHH:mm:ss+08:00`. Using UTC (`Z` suffix) is FORBIDDEN.

## 4b. Project Skill System (專案衍生技能系統)
- **Project Skills Directory**: AI-generated reusable skills are stored in `.agents/project_skills/` as individual SKILL.md files. A symlink at `.agents/skills/_project` points to this directory, enabling IDE auto-discovery. This mirrors the memory card symlink pattern.
- **Readable AND Writable by Master Agent**: Unlike framework-provided skills (read-only), project skills CAN be created and modified by the Master Agent during sanctioned workflows（被授權的工作流中，主腦可建立與修改衍生技能）.
- **Director Review Gate（總監審核閘門）**: ALL newly generated project skills MUST be presented to the Director for approval before activation. The Agent MUST NOT silently create and use project skills without Director visibility.
- **Upgrade Protection（升級保護）**: Framework upgrades (via Deploy-Antigravity.ps1) NEVER touch the `project_skills/` directory. The symlink architecture ensures physical isolation from the `skills/` copy operation.
- **Format Compliance**: Project skills MUST follow the same SKILL.md format as framework skills, including YAML frontmatter with `metadata.origin: project` to distinguish them from framework-provided skills.
- **Skill Generation Binding**: Only workflows that declare `skill_generation: true` in their YAML frontmatter are authorized to create project skills. Load `skill-factory` skill for generation procedures.

## 6. Turbo Mode (受控串聯)
- If a workflow step is annotated with `// turbo`, you are authorized to autonomously chain the next step.

## 10. Skill System (技能組合約)
- **Triple Directory Architecture（三目錄架構）**: The skill ecosystem spans three physically separated directories, each with distinct lifecycle rules:
  1. **Framework Skills** in `.agents/skills/` — Framework-provided, overwritten on upgrade. Read-only for the Agent.
  2. **Project Memory** in `.agents/memory/` — Project-specific knowledge state. Read-write. Protected on upgrade. Symlink: `skills/_memory`.
  3. **Project Skills** in `.agents/project_skills/` — AI-generated reusable operational skills. Read-write during sanctioned workflows. Protected on upgrade. Symlink: `skills/_project`.
- **On-Demand Loading**: Skills are loaded on-demand, NOT always-on.
- **Progressive Disclosure**: Only skill names and descriptions are injected at session start. Full SKILL.md is loaded only when activated.
- **Workflow Binding**: Workflows declare `required_skills` in YAML frontmatter. The Agent MUST load all listed skills before proceeding.
- **Skill Generation Binding**: Workflows that declare `skill_generation: true` in YAML frontmatter authorize the Agent to create new project skills via the `skill-factory` skill.
- **Memory Binding**: Workflows declare `memory_awareness` in YAML frontmatter (`none`, `read`, `full`). `full` means affected memory cards MUST be updated after execution.
- **Available Skills**: Determined by the `.agents/skills/`, `.agents/memory/`, and `.agents/project_skills/` directories.
- **Skill Metadata Standard**: All SKILL.md frontmatter MUST include a `metadata` block with `author`, `version`, `origin` (`framework` or `project`), `memory_awareness` (`none`, `read`, or `full`), and `tool_scope` (array of permitted tool categories) fields.