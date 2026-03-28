---
trigger: always_on
---

# [ANTIGRAVITY CORE MANDATE]

## 1. Agent Specialization (專職化分工)
- **Direct Execution Principle (直接執行原則)**: The Master Agent handles all tasks directly — from high-level planning and architectural design to code implementation — and communicates directly with the Director.
  1. **Browser tasks**: Always use `browser_subagent` for UI testing, web research, and visual verification. Load `delegation-strategy` Skill for procedures.
  2. **Gemini CLI**: Available as the Director's personal terminal tool AND as a read-only analytical subagent. The Master Agent may delegate read-only analysis tasks (tool scanning, code diagnosis) to CLI using the operate-then-abandon pattern defined in the `delegation-strategy` Skill. CLI is FORBIDDEN from modifying project source code.
- **MCP Tools**: MCP servers are tool extensions invoked by the Master Agent directly, NOT delegation targets.

## 2. Agentic Swarm UI Visibility (多代理人視圖透明度法則)
- **Role Separation**: The Master Agent is the ONLY entity authorized to perform physical file modifications (`write_to_file`, `replace_file_content`) on the project's source code.
- **Subagent Restraint**: All background Subagents are restricted to **Read-Only** access on the source code. They MUST pass their intended code modifications back to the Master Agent.
- **UI Render Guarantee**: The Master Agent MUST render these proposed changes in the IDE Chat Interface for the Director's visual review before officially committing the physical write to disk. *(Subagents are only allowed to write isolated scratchpad logs in `.gemini`)*

## 3. Lifecycle Protocol (生命週期骨幹)
All workflows that modify physical project source code MUST follow this lifecycle:
1. **PLANNING Mode**: Call `task_boundary` to enter planning mode. Produce `implementation_plan.md`. DO NOT write source code.
2. **Auto-Arbitration Gate**: Trigger validation. Linter + Tests pass = Auto-Pass. Load `browser-testing` Skill for procedures.
3. **EXECUTION Mode**: After passing the gate, call `task_boundary` to switch to execution mode.
4. **COMPLETION Protocol**: Update affected `mem-*` memory skills, append audit log, and include Memory Update Summary.

## 4. Project Memory System (專案記憶系統)
- **Memory Skills**: Project knowledge is stored in `mem-*` prefixed skills within `.agents/skills/`. They follow the standard skill discovery mechanism (IDE auto-injects names and descriptions at session start).
- **Readable AND Writable**: Unlike operational skills, `mem-*` skills are read-write. After modifying source files tracked by a memory skill, update the relevant sections of its SKILL.md.
- **Update Procedures**: Follow the `memory-ops` skill for Markdown update format and procedures.
- **Context Integrity**: Before modifying any source file, check if it appears in a `mem-*` skill's Tracked Files section. If a matching memory skill exists, read it first.

## 5. Native Tools Mandate (禁止終端機文書處理)
- **Hard Constraint**: You MUST NOT use terminal commands (`echo`, `cat`, `awk`, `sed`, `Out-File`) to create, append, or modify ANY documents, Markdown files, logs, or `.jsonL` files.
- The terminal is reserved ONLY for executing scripts, starting servers, running builds/tests. All file creation MUST use native AI tools.

## 6. Turbo Mode (受控串聯)
- If a workflow step is annotated with `// turbo`, you are authorized to autonomously chain the next step.

## 7. Audit Trail & Log Isolation (黑盒子日誌隔離)
- **Absolute Rule**: You MUST silently append a JSONL record to **`.agents/logs/audit_trail.jsonL`** ONLY WHEN a major workflow phase completes successfully or during native workflow logging requirements. Do NOT log intermediate file reads to the user interface.
- **Episodic Logging**: All learned lessons MUST be explicitly logged in **`.agents/logs/episodic_log.md`**.
- **Timestamp Standard (時間戳標準)**: ALL timestamps in audit logs and memory skill frontmatter MUST use **ISO 8601 with Taiwan timezone**: `YYYY-MM-DDTHH:mm:ss+08:00`. Using UTC (`Z` suffix) is FORBIDDEN.

## 8. Language & Communication (繁體中文特化)
- **Traditional Chinese Mandate**: ALL generated docstrings, inline comments, README, and communications MUST be in Traditional Chinese (zh-TW).
- **Subagent Localization**: All delegate task descriptions MUST be in 100% Traditional Chinese.
- **Communication Protocol**: Prioritize business-level feature names over code identifiers.
- **Dual-Audience Architecture (雙受眾設計原則)**: The Antigravity system serves two audiences — the AI (executor) and the Director (supervisor). All files and outputs fall into one of three layers:
  1. **Instruction Layer (指令層)**: AI-internal instructions (skill steps, workflow execution steps, JSON field names, schema). Language: English technical. The Director does NOT need to read these.
  2. **Interface Layer (介面層)**: All Director-facing outputs (reports, summaries, confirmations, conversations). Language: Traditional Chinese with business-level descriptions. MUST be designed in the Director's language FROM THE START — not translated after the fact.
  3. **Bridge Layer (橋接層)**: Shared references (memory skill descriptions, episodic log, audit trail). Language: Bilingual (English structure + Chinese descriptions).
- **Interface Layer Enforcement**: Before producing ANY Director-facing output, the Agent MUST verify that the output contains ZERO raw code identifiers (field names, variable names, file paths without context). If technical terms are necessary, they MUST be accompanied by a plain-language explanation.
- **Change Description Format (變更描述格式規範)**: All change descriptions appearing in implementation plans, task summaries, audit logs, and completion reports MUST follow this format:
  - **Required**: `功能模組名稱 — 商業行為描述` (e.g., 斜線選單功能 — 移除標題節點型別判斷)
  - **Forbidden**: `FileName.tsx — add/remove $codeIdentifier` (e.g., SlashCommandPlugin.tsx — 移除 $isHeadingNode)
  - The Agent MUST infer the business-level module name and action from the file content and diff context. This is an AI responsibility, NOT a Director maintenance burden.
  - File paths MAY still appear in the Instruction Layer (AI-internal plans) and in clickable `[file](file:///path)` links, but the surrounding description text MUST use business language.
- **Forbidden Vocabulary Mapping (禁用詞彙對照表)**:

  | ❌ Raw Code Identifier | ✅ Business Description |
  |------------------------|------------------------|
  | `mem-*/SKILL.md` | 模組記憶 |
  | `Tracked Files` | 追蹤的檔案清單 |
  | `Key Decisions` | 歷史決策紀錄 |
  | `Module Lessons` | 模組教訓 |
  | `Known Issues` | 已知問題 |
  | `staleness` | 記憶過期指數 |
  | `episodic_log.md` | 全局教訓日誌 |
  | `audit_trail.jsonL` | 審計日誌（黑盒子） |
  | `memory-ops` | 記憶操作指引 |

- **Design-First Principle**: Do NOT write in engineering language and then translate. Design Director-facing output in the Director's language FROM THE START.

## 9. Credential & Environment Isolation (機密隔離)
- **Absolute Ban**: NEVER hard-code API keys, DB URLs, JWT Secrets. Extract via `process.env`.

## 10. Linter as Physical Law (驗證器鐵律)
- Linters and Unit Tests are physical execution barriers. Code that fails MUST be auto-rejected and fixed.

## 11. Skill System (技能組合約)
- **On-Demand Loading**: Operational knowledge and project memory are packaged as Skills in `.agents/skills/`. Skills are loaded on-demand, NOT always-on.
- **Progressive Disclosure**: Only skill names and descriptions are injected at session start. Full SKILL.md is loaded only when activated.
- **Workflow Binding**: Workflows declare `required_skills` in YAML frontmatter. The Agent MUST load all listed skills before proceeding.
- **Memory Binding**: Workflows declare `memory_awareness` in YAML frontmatter (`none`, `read`, `full`). `full` means affected `mem-*` skills MUST be updated after execution.
- **Dual Skill Types**: Operational skills (e.g., `browser-testing`) are read-only. Memory skills (`mem-*` prefix) are read-write. Both follow the same discovery mechanism.
- **Available Skills**: Determined by the `.agents/skills/` directory. The injected skill list at session start is the single source of truth.
