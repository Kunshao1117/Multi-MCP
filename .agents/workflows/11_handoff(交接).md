---
description: Generates a structured handoff prompt for the next AI conversation by scanning all memory skills and summarizing the current session's work.
required_skills: [memory-ops]
memory_awareness: full
---

# [WORKFLOW: HANDOFF (交接)]

> **Required Skills**: 見 YAML `required_skills` 欄位。

## 1. Memory Skill State Aggregation
- 調用 MCP 工具 `cartridge-system__memory_list` 取得專案內所有記憶模組清單。
- 若需深入了解特定記憶，調用 `cartridge-system__memory_read` 取得完整內容。
- **Project Skills Scan（衍生技能掃描）**: List all project skills in `.agents/project_skills/`. Read each SKILL.md frontmatter to collect names and descriptions for inclusion in the handoff prompt.
- **Skill-Memory Cross-Reference（技能記憶對照）**: For each memory card, collect its `## Applicable Skills` entries. Include a summary mapping in the handoff to help the next AI understand which skills govern which modules.

## 2. Session Delta Extraction
- Identify what was accomplished in the CURRENT conversation:
  - Files created, modified, or deleted
  - Architectural decisions made
  - Bugs fixed and lessons learned
  - Any unfinished work-in-progress (WIP)

## 3. Memory Skill Update Enforcement
- Before generating the handoff, verify ALL memory cards are up to date.
- If any skill's content does not reflect the work done in this session, UPDATE IT NOW.
- This step ensures the next AI can rely on memory skills as the source of truth.

## 4. Handoff Prompt Generation
Generate a Markdown Artifact named `handoff_prompt.md` in **Traditional Chinese (繁體中文, zh-TW)** with the following EXACT structure:

```
# 🔄 AI 交接提示詞

## 專案資訊
- 專案名稱：<project name>
- 專案根目錄：<project_root>
- 記憶卡位置：.agents/memory/

## 📍 當前階段
<current phase and overall project status>

## ✅ 本次完成事項
<bulleted list of what was done this session>

## 🔄 進行中的工作 (WIP)
<bulleted list of incomplete tasks, with which memory skill they belong to>

## ⏭️ 下一步優先事項
<ordered list of recommended next actions>

## ⚠️ 注意事項
<known issues, blockers, or traps the next AI should be aware of>

## 🧠 本次關鍵決策
<any architectural or design decisions made this session>

## 🎯 給下一個 AI 的指令
你正在接手一個使用 Antigravity 記憶技能系統的專案。
開始工作前，請先執行以下步驟：
1. 查看 .agents/memory/ 中所有記憶卡，取得專案概覽和模組清單。
2. 根據總監的指令，載入相關模組的記憶技能。
3. 查看每個技能的 status 和 staleness 了解最新進度。
4. 查看 .agents/project_skills/ 中的專案衍生技能，瞭解本專案特有的操作規範。
5. 完成工作後，務必更新受影響模組的記憶技能。
```

## 5. Output Mandate (Strictly zh-TW)
- **Halt**: Output the handoff prompt Artifact and display:
  `[交接完成] 交接提示詞已產出。請總監複製上方內容，貼到下一個對話的開頭即可。`
- Optionally remind the Director: `如需備份，可先執行 /09_commit_log 再關閉對話。`

## COMPLETION GATE（完成閘門 — 不可略過）
> Inherits: `.agents/workflows/_completion_gate.md`
- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Browser Gate)
- **Role**: `Reader/Memory` | 權限依安全閘門矩陣。
