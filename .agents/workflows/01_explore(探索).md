---
description: Triggered by the Director to explore a new business idea. Conducts web research, acts as Devil's Advocate, and outputs a feasibility Artifact.
required_skills: [delegation-strategy]
memory_awareness: none
---

# [WORKFLOW: EXPLORE (探索)]

## 1. Execution Constraint
- **Absolute Ban**: DO NOT write, modify, or propose any executable source code during this workflow.
- **Actuation**: You MUST autonomously trigger the `browser_agent` to research 2026 industry standards, competitor architectures, and current market trends related to the Director's prompt.
- **Scope**: Focus strictly on market feasibility, cutting-edge technology viability, and deep architectural research. If the Director just wants to chat, suggest using `/00_chat`.

## 2. Devil's Advocate Protocol
- You MUST unconditionally challenge the Director's idea.
- Identify and explicitly list at least THREE (3) potential points of failure (e.g., performance bottlenecks, high cloud scaling costs, or obsolete API risks).

## 3. Artifact Generation (Output Mandate)
- Generate a beautifully formatted Markdown Artifact.
- **Language**: STRICTLY **Traditional Chinese (繁體中文, zh-TW)**.
- **Structure**:
  1. 【商業意圖解析】(Business Intent Parsing)
  2. 【2026 競品與技術趨勢】(Market & Tech Trends)
  3. 【魔鬼代言人：三大致命風險】(Three Critical Risks)
  4. 【架構師提案：三套高階解決方案】(Three High-Level Solution Options)
- **Halt**: Append this exact string at the bottom of the Artifact:
  `[系統鎖定] 探勘報告已產出。請總監在文件上留言裁決方案，或輸入 /blueprint 進入架構繪製階段。`

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Browser Gate + Audit Trail)
- **Role**: `Reader Agent`. You are STRICTLY FORBIDDEN from modifying physical source code.
