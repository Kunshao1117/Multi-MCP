---
description: Full-spectrum project health audit — workspace security, memory skill integrity, source code logic, API integration, performance, and maintainability.
required_skills: [memory-ops, tech-stack-protocol, delegation-strategy, code-audit, test-patterns, a11y-testing]
memory_awareness: full
---

# [WORKFLOW: AUDIT & MEMORY HEALTH (專案健檢)]

> **Required Skills**: Load `memory-ops`, `tech-stack-protocol`, `security-sre`, `code-quality`, and `code-audit` skills before proceeding.

## 1. Global Workspace Security Scan
- Scan `package.json`, `requirements.txt`, or equivalent for deprecated packages/CVEs.
- Scan for hardcoded API keys, orphaned files, and unused dependencies.

## 2. Memory Skill System Initialization Check
- Resolve two independent paths and store as variables for the entire workflow:
  - `workspace_root` = the IDE workspace directory (contains `.agents/` and `.gemini/`). CLI starts here.
  - `project_root` = the source code root (contains `package.json` / `src/`). May be `workspace_root` itself or a subdirectory.
  - `agents_dir` = `workspace_root/.agents`
- Detect the project source code root directory within the workspace. Store as `project_root`.
- If no memory cards exist in `.agents/memory/`:
  - Prompt the Director to run `/02_blueprint` to initialize the memory skill system.
  - Report: "記憶技能系統尚未初始化。"
- If `_system/SKILL.md` does NOT exist in `.agents/memory/` but other memory cards do:
  - Execute Migration Protocol to create the system memory skill.

## 3. Progressive Memory Skill Mapping
- **Absolute Rule**: Do NOT scan or map directories matching `.git`, `node_modules`, `venv`, `__pycache__`, `dist`, `build`, `.next`, or any binary/image files.
- **Phase A (Structure Scan)**: Scan the project directory tree from `project_root`. List all existing memory cards in `.agents/memory/`. For each, `view_file` its `SKILL.md` — do NOT skip reading the actual content.
- **Phase B (Gap Detection)**: Identify source files/modules NOT covered by any existing memory card's `## Tracked Files`.
  - For each uncovered module: check if it belongs to an existing functional domain card (using `scopePath` containment). If yes, create as a nested child card. If no, create at root level. Follow the Nesting Decision Tree in `memory-ops` skill § 5.
  - Populate with auto-detected tracked files, key decisions, bilingual `description` (English + Chinese keywords), and relations.
- **Phase C (Staleness & Schema Check)**: For each existing memory card, `view_file` the `SKILL.md` and validate:
  1. **Schema Compliance**: All required sections per `memory-ops` skill are present (frontmatter with `last_updated`, `status`, `staleness` + body with `Tracked Files`, `Key Decisions`, `Known Issues`, `Module Lessons`, `Relations`, `Applicable Skills`).
  2. **Field Type Check**: `status` is one of `stable`, `in_progress`, `deprecated`. `staleness` is a number.
  3. **Tracked File Verification**: Each `## Tracked Files` entry exists on disk.
  4. **Staleness Evaluation**: Read `staleness` value.
  5. **Granularity Check**: Count tracked files. If > 8, flag as 🟡 and include split suggestion in the report. Scan nested subdirectories for child cards (max depth 4). If `scopePath` is missing, note as upgrade candidate.
  - If `staleness` > 10, trigger an automatic regeneration of the skill content.
  - If ALL tracked files are gone → move the entire skill folder to `_archived/`.
  - If SOME tracked files changed → update the skill and reset `staleness` to 0.
- **Phase D (System Memory Refresh)**: `view_file` the project's dependency files (`package.json`, `requirements.txt`, `go.mod`, or equivalent if they exist). Compare against `.agents/memory/_system/SKILL.md` tech stack sections. Flag any discrepancies and update if needed.
- **Phase E (Cross-Reference Integrity)**: For each card's `## Relations`, verify each referenced memory card exists. Flag any orphaned references pointing to non-existent or archived cards.
- **Phase F (Workflow-Skill Binding)**: For each workflow file in `.agents/workflows/`, read its YAML frontmatter `required_skills` and `memory_awareness` fields. Verify each listed skill has a corresponding folder in `.agents/skills/`. Verify `memory_awareness` is one of `none`, `read`, `full`. Verify each skill's `tool_scope` metadata field exists and contains valid category values (`filesystem:read`, `filesystem:write`, `mcp:{server}`, `browser`, `terminal`). Flag any broken bindings or missing fields.
- **Phase G (Project Skills Health — 專案衍生技能健康檢查)**: Scan `.agents/project_skills/` directory:
  1. Count total project skills. Verify each has a valid SKILL.md with compliant frontmatter (`metadata.origin: project`).
  2. Check for stale or unused project skills — if a skill has not been referenced by any workflow or memory card in the current session context, flag as a candidate for archival.
  3. Verify naming compliance (kebab-case, 1-64 characters).
  4. If recurring patterns are detected across 3+ module memory cards that are NOT covered by any existing skill, RECOMMEND creating a new project skill.

## 3.5 Source Code Deep Audit（原始碼深度審計）

> **Execution Condition**: This section ONLY executes when memory cards contain non-empty `## Tracked Files`. If the project is a pure framework/ruleset (e.g., Antigravity itself), output: 「本專案無應用程式原始碼，跳過深度審計。」 and skip to §4.

### Step 1: CLI Tool Scan (CLI 工具掃描 — 委派)

Follow the `code-audit` skill §1 procedures:

1. Read `.agents/memory/_system/SKILL.md` to determine the tech stack.
2. Read all active memory cards' `## Tracked Files` to compile the full file paths list.
3. Construct the CLI task prompt:
   - Load `delegation-strategy` skill's `references/cli-prompt-skeleton.md` as骨架
   - Load `code-audit` skill's `references/scan-task-prompt.md` 填入掃描任務區塊
   - Load `code-audit` skill's `references/scan-report-template.md` 填入輸出格式
   - Fill variables: `{project_root}`, `{agents_dir}`, `{file_paths_list}`, `{memory_skill_list}`
4. **Write to file** (檔案傳令): `write_to_file` → `{agents_dir}/logs/cli_task.md`
5. Execute the **operate-then-abandon** pattern:
   - `run_command`: `gemini` (start CLI in interactive mode, Cwd = workspace root)
   - `send_command_input`: `請讀取 {agents_dir}/logs/cli_task.md 並執行其中定義的任務`
   - `send_command_input`: Send `\n` (Enter key, as a **separate** call)
   - **Abandon**: Do NOT read further terminal output.
6. Inform the Director: 「CLI 掃描已啟動，CLI 會詢問 MCP 工具執行權限，請選擇 "Allow all server tools for this session"。掃描完成後請通知我繼續。」
7. **Wait** for the Director to confirm the scan is complete before proceeding.

### Step 2: Read Scan Report (讀取掃描報告)

1. `view_file` on `{agents_dir}/logs/scan_report.md`.
2. Parse the report following the format defined in `code-audit` skill §2.
3. Extract key metrics: error/warning counts, critical vulnerabilities, top violated rules.

### Step 3: AI Cross-Boundary Analysis (AI 跨邊界架構分析)

These analyses CANNOT be done by tools — they require understanding of architectural context and cross-referencing with module memory:

#### B. Module Relationship Audit（模組關聯性驗證）
- Read each source file's import/require/from statements.
- Build an actual dependency graph.
- Cross-compare with memory card `## Relations` — flag inconsistencies.
- Detect circular dependencies.

#### C. API Integration Check（API 串接完整性）
- From `.agents/memory/_system/SKILL.md`, extract all known API routes/endpoints.
- Scan frontend source files for all fetch/axios/API invocations.
- Match each frontend call to a backend route — flag unmatched calls (broken endpoint).
- Flag backend routes that are never called from any frontend (Dead API).

#### E. Dead Code / Orphan Detection（死碼與孤立檔案偵測）
- Using the dependency graph from (B), identify source files NOT imported by any other module.
- Exclude known entry points (main, index, app, layout, page).
- Flag remaining files as orphan candidates.

#### F. Key Function Survival Check（關鍵函式存活驗證）
- For each memory card's `## Key Decisions` that reference specific functions, use `grep_search` against the corresponding tracked files.
- Confirm each function/class still exists and its name is unchanged.
- If mismatched → flag skill as needing update.

#### J. Data Layer Consistency（資料層一致性）— conditional on DB in tech_stack
- **Model vs API Response**: Compare database model/schema field definitions with API response structures. Flag mismatches.
- **Migration Integrity**: If migration files exist, verify they correspond to current model definitions.

> **Batch Strategy**: If the project has more than 5 module memory cards, follow the `code-audit` skill §4 batch procedures.

## 4. Migration Protocol (Legacy Fallback)
When initializing memory cards for an old project:
- Detect `project_root`. If legacy `.agents/cartridges/` directory exists, create corresponding memory cards from their contents.
- Ensure old legacy cartridge directories are archived to `.agents/memory/_archived/`.

## 5. Traditional Chinese Output Mandate (Strictly zh-TW)
You MUST halt and output a Traffic Light Health Report and Memory Status EXACTLY matching this Traditional Chinese structure:

【健檢與測繪完畢】: 模組記憶系統已對齊 (System Updated).
【資安狀況 (Traffic Light)】:
 - 🔴 紅燈 (Critical): <如果有，列出>
 - 🟡 黃燈 (Warning): <如果有，列出>
 - 🟢 綠燈 (Healthy): <如果有，列出>
【記憶狀態】:
 - 📦 新增: <本次新建的模組記憶>
 - ♻️ 更新: <本次更新或去腐敗的模組記憶>
【工具掃描摘要】:（取自 CLI 掃描報告）
 - 🧹 ESLint: 錯誤 {N} / 警告 {M} / 最常違反: {top 3 rules}
 - 🛡️ 依賴安全 (npm/yarn audit): 🔴嚴重 {N} 🟠高危 {N} 🟡中等 {N} 🟢低 {N} / 最嚴重: {top vulnerability}
 - 📝 型別檢查: 錯誤 {N}（若有執行）
 - 🏷️ 代辦標記: TODO {N} / FIXME {N} / HACK {N}
 - 🔑 環境變數: {不一致項目數}
【AI 架構分析】:（主腦直接分析）
 - 🔗 模組關聯異常: <哪些模組的實際依賴關係跟記憶記錄的不一致>
 - 🔌 前後端串接缺口: <前端呼叫了不存在的後端功能 / 後端有功能但前端沒用到>
 - 🗑️ 疑似沒有在用的檔案: <沒有被任何其他檔案引用的孤立檔案>
 - 📋 記憶同步: <記憶記錄的功能跟實際程式碼對不上的模組>
 - 💾 資料層: <資料庫欄位跟 API 回傳的內容不一致 / 資料庫版本升級紀錄缺漏>
【下一步建議】: <給總監的繁體中文簡短建議>

## COMPLETION GATE（完成閘門 — 不可略過）
> Inherits: `.agents/workflows/_completion_gate.md`
- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Browser Gate)
- **Role**: `Reader/Memory Agent`. You are STRICTLY FORBIDDEN from modifying physical source code. You ARE authorized to create, modify, and archive files within `.agents/memory/` and `.agents/logs/`.