---
name: memory-ops
description: >
  Complete operating guide for reading, updating, and creating memory cards.
  MCP Server: cartridge-system
  Use when: 建立、讀取或更新專案記憶卡時載入。本技能取代手動的 Markdown 編輯，強制執行合規自動化。
---

# Memory Skill Operations (記憶技能操作指引)

## 1. Core Mandate (支配規則)

All memory card **writes and updates** are **forbidden** from using `view_file` + `write_to_file` manual operations. You MUST use `cartridge-system` MCP tools to guarantee timezone (`+08:00`) and staleness index accuracy.

> **Exception**: During audit workflows (`/08_audit`), **reading and verification** via `view_file` is permitted to validate memory card contents.

> **Timestamp Standard**: ALL timestamps MUST use `YYYY-MM-DDTHH:mm:ss+08:00`. UTC (`Z` suffix) is FORBIDDEN.

## 2. Reading Memory (載入記憶)

- IDE auto-injects memory card names/descriptions at session start
- Load on-demand via `memory_read` when task involves tracked files
- **Overview** — For handoff (`/11_handoff`) or full project overview, call `memory_list` to get all module names and health status
- **Single module** — For pre-task context loading, call `memory_read` with target module name (e.g., `_system`)

## 3. Repairing Stale Memory (過期修復)

When a memory cartridge has staleness > 0, you **MUST NOT** simply call `memory_update` to reset staleness. Follow this repair procedure:

### Staleness Repair Procedure (過期修復流程)

```
Stale memory card detected?
├── Step 1: Call memory_status(moduleName) ← diagnose staleness
│   ⇒ Returns: staleness index, changed files list (absolute paths), action guidance
├── Step 2: Call view_file on each changed file
│   ⇒ Understand the latest state of the source code
├── Step 3: Call memory_read(moduleName)
│   ⇒ Read existing memory content
├── Step 4: Compare source code changes vs existing memory
│   ⇒ Produce updated memory content (update decisions/known issues/lessons sections)
└── Step 5: Call memory_update(mode: patch or replace)
    ⇒ staleness auto-resets to 0 + pendingChanges auto-cleared
```

> **Core principle**: The purpose of staleness repair is "sync memory with source code", NOT "suppress the alert". Staleness reset is merely a side effect of completing the sync.

## 4. Updating Memory (更新記憶)

After modifying source files tracked by a memory skill, you **MUST** invoke `cartridge-system__memory_update`.

### Mode Selection Decision Tree (模式選擇決策樹)

```
Need to update memory?
├── 🔍 Granularity pre-check: does the target memory card have > 8 trackedFiles?
│   └── Yes → Pause update. Execute § 5.6 split procedure first
│       → Propose split strategy to Director
│       → After Director approves, execute split, then update the resulting child cards
├── Modifying existing sections (tracked files, architecture description, key decisions)
│   ├── Changing multiple sections or frontmatter → memory_read → modify → memory_update(mode: replace)
│   └── Changing only 1-2 ## or ### sections → memory_update(mode: patch), send only target sections
│       ├── Provided ### subsections are replaced; unmentioned ### are auto-preserved
│       └── Use dryRun: true to preview changes before committing
│
└── Purely appending new entries (lesson records Dxx, known issues)
    └── → memory_update(mode: append) directly, no need to read first
```

- **`replace`** (default): Send complete SKILL.md content for full replacement. Use for structural modifications.
- **`append`**: Send diff paragraphs to append to existing content. Use for incremental additions.
- **`patch`**: Send sections with `##` or `###` headings, without frontmatter. System auto-executes two-layer merge:
  - `##` layer: same-name sections replaced, new sections appended, unmentioned sections preserved
  - `###` layer: if patch contains subsections, only mentioned `###` are replaced, unmentioned `###` preserved (minimum-match principle)
  - Supports `dryRun: true` parameter — returns change preview without writing to disk
  - Returns structured JSON report (with replaced/added/preserved/removed lists, line diff, warnings)

### Post-Update Checklist
1. **Add lessons** — under `## Module Lessons` if reusable knowledge discovered (format: `Dxx: description`)

### Passive Safety Net (被動防護網)

If memory updates were missed during the workflow, two safety nets exist:
1. **Completion Gate** — forces a file-to-memory cross-reference check before reporting completion
2. **Commit Staleness Warning** — `/09_commit_log` compares `git diff` against tracked files and warns the Director before committing with stale memory

## 5. Creating New Memory (建立新記憶)

When `/02_blueprint` or `/08_audit` identifies a new module:
1. Create folder `.agents/memory/{module}/`
2. Create `SKILL.md` with frontmatter + standard sections
3. Description MUST include Chinese keywords for Director instruction matching
4. Set `scopePath` frontmatter field when applicable

### Nesting Decision Tree (層級判斷決策樹)

```
Create new memory card?
├── Does this module belong to an existing functional domain card?
│   ├── No → Create at `.agents/memory/` root level (layer 1)
│   └── Yes → Is the parent card's depth < 4?
│       ├── No → Max depth reached, create at parent's level (keep flat)
│       └── Yes → Create inside parent card's subdirectory
│           ⇒ Path: `.agents/memory/{parentName}/{child}/SKILL.md`
└── Decision criteria:
    ├── scopePath containment? (child's scopePath is sub-path of parent's)
    ├── Does modifying the child typically require referencing the parent's shared decisions?
    └── Are there 3+ modules under the same domain that can be independently tracked?
```

> See `references/memory-template.md` for the complete template.

## 5.5 Tree Structure (樹狀結構指南)

Memory cards support parent-child hierarchy via **directory structure**:

- Layer 1-2 cards live in `.agents/memory/` direct subdirectories (IDE auto-injects names)
- Layer 3-4 cards live inside **parent card's subdirectory** (IDE cannot see; AI loads on-demand after reading parent)
- Maximum depth: **4 layers**
- **`scopePath`** (optional): directory prefix this card is responsible for, used for file attribution

### Directory Example (目錄範例)

```
.agents/memory/
├── api/                          ← Layer 1 (functional domain) depth=1
│   ├── SKILL.md                  ← Shared API architecture decisions
│   ├── auth/                     ← Layer 2 depth=2, parent='api'
│   │   ├── SKILL.md              ← Auth module specific decisions
│   │   └── oauth/                ← Layer 3 depth=3
│   │       └── SKILL.md          ← OAuth sub-module
│   └── manage/                   ← Layer 2 depth=2, parent='api'
│       └── SKILL.md              ← Management module
└── frontend/                     ← Layer 1 (independent domain)
    └── SKILL.md
```

### Loading Nested Cards (子卡載入流程)

1. IDE only injects layer 1-2 names and descriptions
2. AI discovers child cards from `## Relations` section after reading parent
3. Load deep memory on-demand via `memory_read(childName)`
4. `resolveSkillPath` handles nested path resolution automatically — AI does not need to know physical directory locations

### Granularity Principle (粒度判斷原則)

> One memory card = one independent change unit. If modifying A typically does not require modifying B, then A and B should be in separate cards.

- Each memory card tracks no more than **8 files**
- When exceeded, `memory_list` will proactively suggest splitting

## 5.6 Splitting Memory Cards (拆分操作步驟)

When the system flags a memory card as oversized, or maintenance difficulty is discovered during routine work:

```
Need to split a memory card?
├── Step 1: Call memory_read to get the full content of the old card
│   ⇒ Analyze trackedFiles directory distribution and Key Decisions attribution
├── Step 2: Propose split strategy to Director
│   ⇒ Explain which decisions promote to shared (parent) and which demote to (child)
├── Step 3: Execute after Director approves
│   ├── Promote the original card to parent (retain shared decisions + scopePath)
│   ├── Create child card subdirectories under parent (each with scopePath + specific decisions)
│   └── memory_update to update parent content (trim to shared portions only)
└── Step 4: Plugin auto scan + refresh
    ⇒ Index and file watchers update automatically
```

## 6. System Memory (系統記憶)

`_system/SKILL.md` (in `.agents/memory/`) stores tech stack, host platform, and deployment config.
Same update rules apply.
