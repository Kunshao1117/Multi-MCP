---
description: 分析堆疊追蹤與日誌，將技術性故障翻譯為白話的商業影響說明。
required_skills: [memory-ops, delegation-strategy, code-diagnosis]
memory_awareness: read
---

# [WORKFLOW: DEBUG (除錯)]


## 0. Memory Recall (記憶載入)

> [LOAD SKILL] 讀取記憶前，必須參考操作指引：
> `view_file .agents/skills/memory-ops/SKILL.md`

- Check the IDE-injected skill list for memory cards relevant to the failing module.
- Load relevant memory card SKILL.md files — check `## Known Issues` to determine if this is a documented problem.

## 1. Hardened Evidence Collection

- **Absolute Ban**: DO NOT invent or assume bug causes.
- You MUST actively use terminal tools (`cat`, `tail`, or read terminal IDs) to extract logs from the target process, browser console inputs, or the `/logs` directory based on the Director's description.

## 1.5 CLI Code Diagnosis (CLI 程式碼診斷 — 可選步驟)

> **Trigger**: Evaluate the `code-diagnosis` skill §1 trigger conditions. If ANY condition is met, execute this step. Otherwise, skip to §2.

When triggered:

> [LOAD SKILL] 啟動 CLI 診斷時才讀取：
> 1. `view_file .agents/skills/delegation-strategy/SKILL.md`
> 2. `view_file .agents/skills/code-diagnosis/SKILL.md`

1. Execute the CLI delegation following `delegation-strategy` SOP.
2. Construct prompt using `code-diagnosis` template.
3. Construct the diagnosis prompt:
   - **fault_symptoms**: Summarize the evidence collected in §1 (stack traces, error messages, Director's description)
   - **suspect_modules**: List the memory modules most likely related to the fault
4. Execute the CLI delegation following `delegation-strategy` §3 (operate-then-abandon)
5. Inform the Director: 「CLI 程式碼診斷已啟動。完成後請通知我繼續。」
6. **Wait** for the Director to confirm CLI has finished
7. Read the diagnosis report: `view_file` on `{agents_dir}/logs/diagnosis_report.md`
8. Follow `code-diagnosis` §4 review guide to validate CLI's findings
9. Incorporate validated findings into §2 Root Cause Translation

## 2. Root Cause Translation

- Generate a Root Cause Analysis (RCA) Artifact in **Traditional Chinese (繁體中文)**.
- **Structure**:
  1. 【故障症狀】(What is broken physically)
  2. 【日誌實證】(Exact excerpt of the error trace found)
  3. 【CLI 診斷摘要】(Summary of CLI diagnosis findings, if §1.5 was executed — omit if not)
  4. 【根因白話文解析】(Why it broke, translated into plain business logic)
  5. 【概念修復方案】(Proposed architectural fix)
  6. 【技能萃取建議】(If the debugging methodology developed in this session is reusable across future incidents, recommend creating a project skill via `/12_skill_forge` — 若本次歸納出可重用的診斷方法論，建議萃取為專案衍生技能)
- **Halt**: Output: `[防線鎖定] 數位鑑識完畢。若總監同意修復方向，請輸入 /fix 啟動修復程序。`

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Reader` | Permissions based on the security gate matrix。
