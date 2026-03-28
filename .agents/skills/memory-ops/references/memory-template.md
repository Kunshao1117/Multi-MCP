# 記憶技能模板

> 此為 `memory-ops` 技能的參考模板。建立新記憶技能時參照使用。

## YAML Frontmatter（必填欄位）

```yaml
---
name: mem-{module}
description: >
  專案記憶：{中文模組描述}。
  Use when: {何時應該載入此記憶}。
last_updated: YYYY-MM-DDTHH:mm:ss+08:00
status: stable | in_progress | deprecated
staleness: 0
---
```

## Markdown Body（標準區段）

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
- mem-other-module
```
