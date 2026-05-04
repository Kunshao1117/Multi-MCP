---
name: memory-arch
description: >
  [Infra] Memory architecture topology guide: layer resolution, splitting rules, and static container specifications.
  Use when: 需要決定記憶卡的層級架構、拆分過大的記憶卡、收容特殊檔案、或了解整體系統分佈時載入。
  DO NOT use when: 純更新記憶卡內容或修復過期指數（用 memory-ops）。
metadata:
  author: antigravity
  version: "1.0"
  origin: framework
  memory_awareness: none
  tool_scope: ["filesystem:write", "mcp:cartridge-system"]
---

# Memory Architecture (記憶卡架構與拓樸)

## 1. Creating New Memory (建立新記憶)

```
New module identified by /02_blueprint or /08_audit?
├── Step 1: Determine nesting level (see Nesting Decision Tree below)
├── Step 2: Create folder at resolved path → `.agents/memory/{module}/`
├── Step 3: Create SKILL.md using template → see references/memory-template.md
│   ⇒ frontmatter: name, description (MUST include Chinese keywords), scopePath
│   ⇒ body: Tracked Files, Key Decisions, Known Issues, Module Lessons, Relations, Applicable Skills
└── Step 4: Call memory_commit(moduleName, projectRoot)
    ⇒ Registers card in index + validates structure
```

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

## 2. Tree Structure (樹狀結構規則)

### Rules (規則)

- Layer 1–2: `.agents/memory/{module}/SKILL.md` — IDE auto-discovers
- Layer 3–4: `.agents/memory/{parent}/{child}/SKILL.md` — AI loads on-demand via `## Relations`
- Maximum depth: **4 layers**
- `scopePath` (optional): directory prefix for file attribution matching

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

```
Need to access a nested card (layer 3–4)?
├── Step 1: Read parent card → check ## Relations for child card names
├── Step 2: Call memory_read(childName)
│   ⇒ resolveSkillPath handles path resolution automatically
└── No manual path construction needed
```

### Granularity Rule (粒度規則)

- Maximum **8 tracked files** per card
- Exceeded → `memory_list` flags automatically → execute § 3 Splitting Memory Cards

## 3. Splitting Memory Cards (拆分操作步驟)

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
│   └── write_to_file to update parent SKILL.md (trim to shared portions only)
├── Step 4: Plugin auto scan + refresh
│   ⇒ Index and file watchers update automatically
├── Step 5: Call memory_commit for EACH new child card
│   ⇒ Each child card must be individually committed
└── Step 6: Call memory_commit for the parent card
    ⇒ Parent card's trimmed content must also be committed
```

## 4. Static Container Cards (靜態收容卡匣)

### Rules & Definitions
對於必須被 git 追蹤但缺乏商業動態邏輯的檔案（如 `package-lock.json`、`assets/*.png`），強烈建議建立專職的「靜態收容卡匣」以避免幽靈檔案污染。

### Naming Convention (命名約定)
這類卡匣的名稱必須以底線開頭（例如：`_assets`、`_ghost_bin`、`_config_locks`），明確標示其「非業務邏輯記憶」的屬性。

### Green Channel & Staleness Privilege (過期放寬特權)
這類帶底線的收容卡匣若因鎖定檔或靜態資源更新而產生卡匣過期警報（Staleness > 0），AI 具有特權：
- **跳過繁瑣檢視**：在確認該異動無視野安全風險後，可合法略過 `memory-ops` 原有之 6 步檢索流程。
- **單步核銷**：直接發動 `memory_commit` 單步歸卡以快速核銷警報。
