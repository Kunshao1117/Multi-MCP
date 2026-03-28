---
name: memory-ops
description: >
  記憶技能讀寫操作指引。
  Use when: 建立、讀取或更新 mem-* 專案記憶技能時載入。
---

# Memory Skill Operations (記憶技能操作指引)

## 1. Reading Memory (載入記憶)

- IDE auto-injects `mem-*` names/descriptions at session start
- Load on-demand via `view_file` when task involves tracked files
- No Pre-Flight ceremony — this IS the natural skill loading behavior

## 2. Updating Memory (更新記憶)

After modifying source files tracked by a memory skill:

1. **Update relevant sections** — add/modify entries under the appropriate `##` heading
2. **Update frontmatter** — `last_updated` to current timestamp, reset `staleness: 0`
3. **Add lessons** — under `## Module Lessons` if reusable knowledge discovered (format: `Dxx: description`)
4. **Cross-module lessons** — log in `.agents/logs/episodic_log.md`

> **Timestamp Standard**: ALL timestamps MUST use `YYYY-MM-DDTHH:mm:ss+08:00`. UTC (`Z` suffix) is FORBIDDEN.

### Passive Safety Net (被動防護網)

If memory updates were missed during the workflow, two safety nets exist:
1. **Completion Gate** — forces a file-to-memory cross-reference check before reporting completion
2. **Commit Staleness Warning** — `/09_commit_log` compares `git diff` against tracked files and warns the Director before committing with stale memory

## 3. Creating New Memory (建立新記憶)

When `/02_blueprint` or `/08_audit` identifies a new module:
1. Create folder `.agents/skills/mem-{module}/`
2. Create `SKILL.md` with frontmatter + standard sections
3. Description MUST include Chinese keywords for Director instruction matching

> 完整模板見 `references/memory-template.md`

## 4. System Memory (系統記憶)

`mem-_system/SKILL.md` stores tech stack, host platform, and deployment config.
Same update rules apply.
