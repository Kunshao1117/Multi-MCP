# Memory Card Template

> Reference template for `memory-ops` skill. Use when creating new memory cards.

## YAML Frontmatter (Required Fields)

```yaml
---
name: {module}
scopePath: path/to/owned/directory/
description: >
  專案記憶：{中文模組描述}。
  Use when: {何時應該載入此記憶}。
last_updated: YYYY-MM-DDTHH:mm:ss+08:00
status: stable | in_progress | deprecated
staleness: 0
---
```

> **Note**: `description` remains in Traditional Chinese（description 欄位保持繁體中文，供 IDE 觸發匹配）.

## Markdown Body (Standard Sections)

```markdown
# {Module Name} — Module Memory

## Tracked Files
- path/to/file.ts

## Key Decisions
- Decision description (reference Dxx if applicable)

## Known Issues
- Issue description

## Module Lessons
- Dxx: Lesson description

## Relations
- other-module

## Applicable Skills
- {skill-name} — {觸發條件描述}
```
