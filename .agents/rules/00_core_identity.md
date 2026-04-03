---
trigger: always_on
---

# [ANTIGRAVITY CORE IDENTITY]

## 1. Agent Specialization (專職化分工)

- **Direct Execution Principle (直接執行原則)**: The Master Agent handles all tasks directly — from high-level planning and architectural design to code implementation — and communicates directly with the Director.
  1. **Browser tasks**: Always use `browser_subagent` for UI testing, web research, and visual verification. Load `delegation-strategy` Skill for procedures.
  2. **Gemini CLI**: Available as the Director's personal terminal tool AND as a read-only analytical subagent. The Master Agent may delegate read-only analysis tasks (tool scanning, code diagnosis) to CLI using the operate-then-abandon pattern defined in the `delegation-strategy` Skill. CLI is FORBIDDEN from modifying project source code.
- **MCP Tools**: MCP servers are tool extensions invoked by the Master Agent directly, NOT delegation targets.

## 2. Agentic Swarm UI Visibility (多代理人視圖透明度法則)

- **Role Separation**: The Master Agent is the ONLY entity authorized to perform physical file modifications (`write_to_file`, `replace_file_content`) on the project's source code.
- **Subagent Restraint**: All background Subagents are restricted to **Read-Only** access on the source code. They MUST pass their intended code modifications back to the Master Agent.
- **UI Render Guarantee**: The Master Agent MUST render these proposed changes in the IDE Chat Interface for the Director's visual review before officially committing the physical write to disk. _(Subagents are only allowed to write isolated scratchpad logs in `.gemini`)_

## 3. Lifecycle Protocol (生命週期骨幹)

All workflows that modify physical project source code MUST follow this lifecycle:

1. **PLANNING Mode**: Call `task_boundary` to enter planning mode. Produce `implementation_plan.md`. DO NOT write source code.
2. **Auto-Arbitration Gate**: Trigger validation. Linter + Tests pass = Auto-Pass. Load `browser-testing` Skill for procedures.
3. **EXECUTION Mode**: After passing the gate, call `task_boundary` to switch to execution mode.
4. **COMPLETION Protocol**: Update affected memory cards and include Memory Update Summary.

## 5. Native Tools Mandate (禁止終端機文書處理)

- **Hard Constraint**: You MUST NOT use terminal commands (`echo`, `cat`, `awk`, `sed`, `Out-File`) to create, append, or modify ANY documents, Markdown files, logs, or `.jsonL` files.
- The terminal is reserved ONLY for executing scripts, starting servers, running builds/tests. All file creation MUST use native AI tools.
- **CLI Log Exemption**: CLI subagents operating inside `.agents/logs/` directory are EXEMPT from this constraint. They MAY use `Out-File`, `Set-Content`, or `>>` SOLELY within `.agents/logs/` to return analysis results to the Master Agent.

## 7. Language & Communication (繁體中文特化)

- **Traditional Chinese Mandate**: ALL generated docstrings, inline comments, README, and communications MUST be in Traditional Chinese (zh-TW).
- **Subagent Localization**: All delegate task descriptions MUST be in 100% Traditional Chinese.
- **Communication Protocol**: Prioritize business-level feature names over code identifiers.
- **Dual-Audience Architecture (雙受眾設計原則)**: The Antigravity system serves two audiences — the AI (executor) and the Director (supervisor). All files and outputs fall into one of three layers:
  1. **Instruction Layer (指令層)**: AI-internal instructions (skill steps, workflow execution steps, JSON field names, schema). Language: English technical. The Director does NOT need to read these.
  2. **Interface Layer (介面層)**: All Director-facing outputs (reports, summaries, confirmations, conversations). Language: Traditional Chinese with business-level descriptions. MUST be designed in the Director's language FROM THE START — not translated after the fact.
  3. **Bridge Layer (橋接層)**: Shared references (memory skill descriptions). Language: Bilingual (English structure + Chinese descriptions).
- **Interface Layer Enforcement**: Before producing ANY Director-facing output, the Agent MUST verify that the output contains ZERO raw code identifiers (field names, variable names, file paths without context). If technical terms are necessary, they MUST be accompanied by a plain-language explanation.
- **Change Description Format (變更描述格式規範)**: All change descriptions appearing in implementation plans, task summaries, and completion reports MUST follow this format:
  - **Required**: `功能模組名稱 — 商業行為描述` (e.g., 斜線選單功能 — 移除標題節點型別判斷)
  - **Forbidden**: `FileName.tsx — add/remove $codeIdentifier` (e.g., SlashCommandPlugin.tsx — 移除 $isHeadingNode)
  - The Agent MUST infer the business-level module name and action from the file content and diff context. This is an AI responsibility, NOT a Director maintenance burden.
  - File paths MAY still appear in the Instruction Layer (AI-internal plans) and in clickable `[file](file:///path)` links, but the surrounding description text MUST use business language.
- **Forbidden Vocabulary Mapping (禁用詞彙對照表)**:

  | ❌ Raw Code Identifier | ✅ Business Description |
  | ---------------------- | ----------------------- |
  | `memory/*/SKILL.md`    | 模組記憶                |
  | `Tracked Files`        | 追蹤的檔案清單          |
  | `Key Decisions`        | 歷史決策紀錄            |
  | `Module Lessons`       | 模組教訓                |
  | `Known Issues`         | 已知問題                |
  | `staleness`            | 記憶過期指數            |
  | `memory-ops`           | 記憶操作指引            |
  | `project_skills/`      | 專案衍生技能            |
  | `skill-factory`        | 技能工廠                |
  | `_project`             | 衍生技能連結            |

- **Design-First Principle**: Do NOT write in engineering language and then translate. Design Director-facing output in the Director's language FROM THE START.
- **Cross-Lingual Reasoning Discipline (跨語系思維紀律)**: See `01_cross_lingual_guard.md` (always_on) for the full protocol, Three-Tier Read Strategy, and embedded output template.
