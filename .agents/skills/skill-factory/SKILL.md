---
name: skill-factory
description: >
  Skill generation SOP for creating new project-specific skills.
  Enforces format compliance, Director review gate, and project_skills/ isolation.
  Use when: 需要建立新的專案衍生技能、從健檢建議萃取技能、
  或任何涉及 技能產生/自動繁衍/建立新技能 的場景。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: full
  tool_scope: ["filesystem:write"]
---

# Skill Factory — Project Skill Generation Protocol

## 1. Trigger Conditions (觸發條件)

This skill is loaded when the Agent needs to create a new project-specific skill. Valid triggers:
1. **Director Directive**: The Director explicitly instructs skill creation（總監明確指示）.
2. **Audit Recommendation**: `/08_audit` Phase G detects recurring patterns across 3+ modules（健檢偵測到跨模組重複模式）.
3. **Post-Fix/Debug Distillation**: `/04_fix` or `/07_debug` identifies a reusable methodology（修復/除錯後萃取方法論）.

## 2. Pre-Generation Checklist

Before generating a new skill, verify:
- [ ] No existing framework skill covers this functionality（不重複現有核心技能）.
- [ ] No existing project skill covers this functionality（不重複現有衍生技能）.
- [ ] The pattern is genuinely reusable (applies to 2+ future scenarios)（模式確實可重用）.
- [ ] The skill name follows kebab-case naming convention（命名遵循連字號格式）.

## 3. Generation Procedure

### Step 1: Name & Scope Definition
- Choose a descriptive kebab-case name (1-64 characters).
- Define the skill's scope — what it covers and what it does NOT cover.

### Step 2: Write SKILL.md
- Use the template in `references/skill-template.md`.
- Frontmatter MUST include `metadata.origin: project`.
- The `description` field MUST include both English and Chinese keywords for IDE trigger matching.

### Step 3: Create Directory Structure
```
.agents/project_skills/{skill-name}/
├── SKILL.md           ← Core instruction file (required)
└── references/        ← Optional L3 resources
    └── ...
```

### Step 4: Register in Skill Index
- Append one row to `.agents/skills/_index.md` with the new skill's keywords.

### Step 5: Verify Symlink Resolution
- Confirm the skill is discoverable via `.agents/skills/_project/{skill-name}/SKILL.md`.

## 4. Format Compliance Rules

### Frontmatter Standard
```yaml
---
name: {skill-name}
description: >
  {English description}.
  Use when: {中文觸發條件描述}。
metadata:
  author: antigravity
  version: "1.0"
  origin: project
  memory_awareness: none|read|full
---
```

### Body Content Standard
The SKILL.md body should follow this section order:
1. **Title**: `# {Skill Name} — {Subtitle}`
2. **Trigger Conditions**: When to load this skill
3. **Procedure**: Step-by-step instructions
4. **Constraints**: Boundaries and limitations
5. **References**: Links to reference files (if any)

## 5. Director Review Gate（總監審核閘門）

ALL newly generated project skills MUST be presented to the Director for approval.
The Agent MUST call `notify_user` with the new SKILL.md path in `PathsToReview` and prompt:
`[技能鍛造] 新的專案衍生技能已建立：{技能功能名稱}。請總監審閱。`

The skill is NOT considered active until the Director approves it.
