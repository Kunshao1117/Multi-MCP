---
trigger: model_decision
description: 記憶卡與技能系統的操作合約。在涉及模組記憶讀寫、技能載入流程、或工作流串聯執行時適用。衍生技能建立請見 05_project_skill_contract.md。
---

# [ANTIGRAVITY MEMORY & SKILL CONTRACT]

## 1. Project Memory System (專案記憶系統)

```
[EXIT HOLD GATE] Before reporting task completion:
├── Director prompt contains [SUDO]?
│   └── YES → Clear hold. Allow completion without memory update.
├── Active workflow is /03_sketch?
│   └── YES → Skip memory check entirely.
├── Were any source files CREATED in this session?
│   └── YES → Find or create a matching memory card for the new module.
│             Load memory-ops skill for card creation procedures.
│             [HALT if no card exists] 「🔴 [MEM HALT] 新建模組尚未建立記憶卡。請先執行歸檔。」
├── Were any source files MODIFIED in this session?
│   ├── NO  → Release hold. Proceed silently.
│   └── YES → Check: did memory-ops fire for ALL affected cards?
│       ├── YES → Release hold. Proceed silently.
│       └── NO  → [HALT] 「🔴 [MEM HALT] 記憶卡尚未更新。請先執行記憶歸卡。」
│                 DO NOT report completion.
└── Hold released → Proceed to Completion Gate.
```

- **Memory Directory**: Project knowledge is stored in `.agents/memory/` as individual SKILL.md files per module. A symlink at `.agents/skills/_memory` points to this directory, enabling IDE auto-discovery.
- **Readable AND Writable**: Unlike operational skills, memory cards are read-write. After modifying source files tracked by a memory card, update the relevant sections of its SKILL.md.
- **Update Procedures**: Follow the `memory-ops` skill for Markdown update format and procedures.
- **Context Integrity**: Before modifying any source file, check if it appears in a memory card's Tracked Files section. If a matching memory card exists, read it first.
- **Skill Cross-Reference (技能交叉引用)**: After loading a memory card, check its `## Applicable Skills` section. If listed skills are not yet loaded, load them to ensure the correct operational constraints are active for that module.
- **Timestamp Standard (時間戳標準)**: ALL timestamps in memory skill frontmatter MUST use **ISO 8601 with Taiwan timezone**: `YYYY-MM-DDTHH:mm:ss+08:00`. Using UTC (`Z` suffix) is FORBIDDEN.



## 2. Turbo Mode (受控串聯)
- If a workflow step is annotated with `// turbo`, you are authorized to autonomously chain the next step.

## 3. Skill System (技能組合約)
- **Triple Directory Architecture（三目錄架構）**: The skill ecosystem spans two primary directories, with project skills managed separately (see `05_project_skill_contract.md`):
  1. **Framework Skills** in `.agents/skills/` — Framework-provided, overwritten on upgrade. Read-only for the Agent.
  2. **Project Memory** in `.agents/memory/` — Project-specific knowledge state. Read-write. Protected on upgrade. Symlink: `skills/_memory`.
- **On-Demand Loading**: Skills are loaded on-demand, NOT always-on.
- **Progressive Disclosure**: Only skill names and descriptions are injected at session start. Full SKILL.md is loaded only when activated.
- **Workflow Binding**: Workflows declare `required_skills` in YAML frontmatter. The Agent MUST load all listed skills before proceeding.
- **Memory Binding**: Workflows declare `memory_awareness` in YAML frontmatter (`none`, `read`, `full`). `full` means affected memory cards MUST be updated after execution.
- **Available Skills**: Determined by the `.agents/skills/` and `.agents/memory/` directories. For project skills, see `05_project_skill_contract.md`.
- **Skill Metadata Standard**: All SKILL.md frontmatter MUST include a `metadata` block with `author`, `version`, `origin` (`framework` or `project`), `memory_awareness` (`none`, `read`, or `full`), and `tool_scope` (array of permitted tool categories) fields.

## 4. Configuration Interface Obligation (全域設定對外義務)
- **Settings Registry**: For core plugin or system-level features that expose behavioral thresholds, exclude paths, or dynamic logic toggles, the developer MUST formally register these settings via VS Code `contributes.configuration` (e.g., `cartridge.excludeDirs`) or an equivalent standard interface.
- **Hardcoding Ban**: Long-living configuration settings MUST NOT be permanently hardcoded in source files (e.g. `src/config.ts`).
- **Memory Tracking Validation**: When a capability depends on configuration interfaces, its corresponding memory card (e.g. `_system` or `extension`) MUST document the associated configuration keys (`cartridge.xxx`) mapped to it.

## 5. Memory Sanitization & Deletion (記憶淨化與汰除機制)

- **Sanitization (淨化義務)**: Before writing to ANY memory card (`SKILL.md`), you MUST scrub all PII (Personally Identifiable Information), absolute system paths containing user names (e.g., `C:\Users\JohnDoe\`), and secret tokens/API keys. Memory cards must contain only architectural knowledge and relative paths.
- **Purging (汰除機制)**: If a module is entirely deleted from the codebase, you MUST physically delete its corresponding memory card from `.agents/memory/` or `project_skills/`. Do NOT leave abandoned memory cards, as they permanently pollute the AI's context.