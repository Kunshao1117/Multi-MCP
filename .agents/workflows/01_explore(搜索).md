---
description: 由總監觸發，探索新商業想法或技術方向。執行網路研究、扮演魔鬼代言人，產出可行性 Artifact。
required_skills: []
memory_awareness: none
---

# [WORKFLOW: EXPLORE (搜索)]

## 1. Execution Constraint

- **Absolute Ban**: DO NOT write, modify, or propose any executable source code during this workflow.
[RECON GATE] Actuation decision:
- IF (research requires only text retrieval or API data):
  - [FAST PATH] MUST use native search tools (`search_web`, `read_url_content`) to prevent resource waste.
- IF (research explicitly requires UI/UX analysis, JS-rendering, or jumping login/CAPTCHA walls):
  - [SLOW PATH] MUST trigger `browser_subagent`.
  - [LOAD SKILL] Before executing browser_subagent, you MUST read:
    `view_file .agents/skills/browser-testing/SKILL.md`

- **Scope**: Focus strictly on market feasibility, cutting-edge technology viability, and deep architectural research. If the Director just wants to chat, suggest using `/00_chat`.

## 2. Devil's Advocate Protocol

[INTENT GATE] Classify Director intent:
- IF (intent is pure information, data, or doc retrieval with NO hypothesis):
  - [STATE A - Pure Information Search] Challenge reliability and completeness. Output exactly three paragraphs:
    1. Source Bias: Check authority and conflicts of interest.
    2. Data Freshness: Flag info older than 18 months.
    3. Search Coverage Gap: List excluded topics or competitors.
- ELSE (intent is to explore a business idea, tech architecture, or scenario):
  - [STATE B - Deep Research & Scenario Analysis] Devil's Advocate mode. Identify at least THREE fatal risks. Each risk MUST include:
    - Risk Description: What could go wrong and why.
    - Failure Scenario: Concrete, realistic failure scene (actors, systems, timing).
    - Quantified Impact: Numeric estimate of impact (e.g., cost, latency, churn rate) or justified range.

## 3. Artifact Generation (Output Mandate)

- Generate a beautifully formatted Markdown Artifact.
- **Language**: STRICTLY **Traditional Chinese (繁體中文, zh-TW)**.
- **Minimum Length**: The body text (excluding headers and the closing lock string) MUST be **no fewer than 800 characters**.
- **Table-First Rule**: Any comparative data (features, costs, vendors, frameworks) MUST be presented in a Markdown table. Prose-only comparisons are forbidden.
- **Quantify-First Rule**: Any claim about market size, cost, performance, or scale MUST include a concrete number or a justified estimate range (e.g., "USD $2M–$5M ARR", "P99 latency < 200ms"). Vague adjectives (e.g., "very expensive", "quite fast") are forbidden.
- **Structure**:
  1. 【商業意圖解析】— State classification (State A or B) + intent summary. Minimum 2 paragraphs.
  2. 【2026 競品與技術趨勢】— Comparative table required. Minimum 3 entries. Minimum 2 paragraphs of analysis.
  3. 【魔鬼代言人：核心風險剖析】— Output as defined in Section 2 (State A: 3 paragraph analysis; State B: 3+ structured risk entries).
  4. 【架構師提案：三套高階解決方案】— Three distinct solution directions. Each solution must include: approach, key trade-offs, and estimated cost/effort tier (Low / Medium / High).
- **Halt**: Append this exact string at the bottom of the Artifact:
  `[系統鎖定] 探勘報告已產出。請總監在文件上留言裁決方案，或輸入 /blueprint 進入架構繪製階段。`

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Reader` | Permissions based on the security gate matrix。
