---
description: 掃描所有記憶技能，彙整當前對話成果，為下一個 AI 對話產出結構化的交接提示詞。
required_skills: [memory-ops]
memory_awareness: full
---

# [WORKFLOW: HANDOFF (交接)]


> [LOAD SKILL] 執行任何步驟前，必須依序讀取：
> 1. `view_file .agents/skills/memory-ops/SKILL.md`
> 2. `view_file .agents/skills/memory-arch/SKILL.md`

## 1. Memory Skill State Aggregation

- Use MCP tool `cartridge-system__memory_list` to get all project memory modules.
- If deep context is needed, use `cartridge-system__memory_read` on specific memories.
- **Project Skills Scan**: List all custom project skills in `.agents/project_skills/`. Extract their names and descriptions from the frontmatter.
- **Skill-Memory Cross-Reference**: For each memory card, collect its `Applicable Skills` entries to build a governance mapping for the handoff prompt.

## 2. Session Delta & Trap Extraction

- You MUST explicitly extract HIGH-RESOLUTION technical details from the current conversation:
  - **Granular Changes**: Specify exact file paths, functions, variables, and state mutations (e.g., "Added sessionToken cookie to auth.ts", NOT just "Fixed login").
  - **Traps & Dead Ends**: Identify any approaches attempted that FAILED (e.g., version conflicts, hydration errors). This prevents the next AI from repeating mistakes.
  - **Hacks & Tech Debt**: Note any `@ts-ignore`, hardcoded values, or lingering console errors left behind.
  - **Infrastructure Delta**: List any new npm packages installed, `.env` variables added, or database schema changes.
  - **WIP & Next Steps**: Identify the exact technical blockage or next immediate function to implement.

## 3. Memory Skill Update Enforcement

[HANDOFF PRE-GATE] Memory freshness verification:
- IF ([SUDO] detected in Director prompt): 
  - Skip check. Generate handoff with stale data. 
  - Warn exactly: 「[SUDO OVERRIDE] 記憶卡可能未更新。交接資訊完整性無法保證。」
- ELSE IF (ANY memory card has staleness > 0):
  - [HALT] Output exactly: 「🔴 [HANDOFF HALT] 記憶卡 {module_name} 過期 (staleness={N})。請先更新再交接。」
  - Do NOT generate the handoff prompt.
- ELSE: Proceed silently to generate handoff_prompt.md.

## 4. Handoff Prompt Generation

Generate a Markdown Artifact named `handoff_prompt.md` in **Traditional Chinese (繁體中文, zh-TW)** using the following EXACT structure:

```markdown
# 🔄 AI 交接提示詞

## 專案資訊
- 專案名稱：<project name>
- 記憶卡位置：.agents/memory/

## 📍 當前階段與總結
<1-2句話精準描述當前功能開發進度>

## ✅ 本次完成事項 (技術細節)
- [<module_name>]：<具體做了什麼，精確到變數、函數或狀態變更>
- [<module_name>]：...

## ⚠️ 防雷與死胡同記錄 (Traps & Dead Ends)
- ❌ 嘗試過的失敗路徑：<記錄行不通的解法、報錯或版本衝突，警告下一個 AI 避開>
- 🚨 遺留技術債 (Hacks)：<記錄寫死的值、@ts-ignore 或目前尚未解決的 Console Error>

## 📦 環境異動 (Infrastructure)
- 依賴變更：<新增了哪些 npm 套件，提醒總監可能需要 npm i>
- Schema/.env：<是否有資料庫結構或環境變數變更>

## 🔄 進行中的工作 (WIP) & 下一步優先事項
1. [<module_name>] 需要處理... <遺留的確切邏輯阻礙>
2. [<module_name>] 準備...

## 🎯 給下一個 AI 的指令
你正在接手一個使用 Antigravity 記憶技能系統的專案。開始工作前，請先執行以下步驟：
1. 查看 .agents/memory/ 中所有記憶卡，取得專案概覽和模組清單。
2. 查看每個技能的 status 和 staleness 了解最新進度。
3. 查看 .agents/project_skills/ 中的專案衍生技能，瞭解本專案特有的操作規範。
4. 針對上方「防雷與死胡同記錄」，絕對不要重複嘗試已經證實失敗的路徑。
5. 針對上方「環境異動」，如果需要，請主動提醒總監執行安裝指令。
```

## 5. Output Mandate

- **Halt**: Output the handoff prompt Artifact and display exactly:
  `[交接完成] 豐富化交接提示詞已產出。請總監複製 Artifact 內容，貼到下一個對話的開頭即可。`
- Remind the Director: `如需備份，可先執行 /09_commit_log 再關閉對話。`

## COMPLETION GATE（完成閘門 — 不可略過）

> Inherits: `.agents/workflows/_completion_gate.md`

- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Reader/Memory` | Permissions based on the security gate matrix。
