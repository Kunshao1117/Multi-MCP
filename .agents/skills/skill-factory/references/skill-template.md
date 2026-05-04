# Project Skill Template

> Reference template for `skill-factory` skill. Use when creating new project skills.

## YAML Frontmatter (Required Fields)

```yaml
---
name: { skill-name }
description: >
  [{Domain}] {English functional description}.
  Use when: {中文正向觸發條件}。
  DO NOT use when: {中文負向排除條件}。
metadata:
  author: antigravity
  version: "1.0"
  origin: project
  style: imperative|guided|hybrid
  memory_awareness: none|read|full
  tool_scope: ["{category1}", "{category2}"]
---
```

> **Note**: `origin` MUST be `project` for all AI-generated skills（origin 欄位必須為 project，區別於核心技能的 framework）.

## Markdown Body (Standard Sections)

```markdown
# {Skill Name} — {Subtitle}

## 1. Trigger Conditions (觸發條件)

When to load this skill:

- Condition 1
- Condition 2

## 2. Procedure (操作步驟)

### Step 1: {Action}

- Instruction detail

### Step 2: {Action}

- Instruction detail

## 3. Constraints (限制與邊界)

- What this skill does NOT cover
- Known limitations

## 4. References (參考資源) — optional

- Link to reference files in `references/` subdirectory
```

## Optional Directories

```
{skill-name}/
├── SKILL.md           ← Required
└── references/        ← Optional: L3 resources
    ├── REFERENCE.md   ← Detailed technical reference
    └── {domain}.md    ← Domain-specific files
```
