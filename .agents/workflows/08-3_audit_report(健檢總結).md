---
name: 08-3_audit_report(健檢總結)
description: "[Phase 3/3] 全光譜健康報告彙整。執行效能審查，並產出最終的紅黃綠燈號決策面板。"
trigger: manual
required_skills:
  - performance-audit
---

# [08-3_audit_report] Traffic Light Health Report Generation

**[SECURITY & COMPLIANCE MANDATE]**
- Role: Master Agent
- Operating Constraint: Read-only aggregation.

## 1. Data Aggregation

**Directive**: Collect all audit states.
1. Read `.agents/cartridges/_system.md` and related memory cards.
2. Read `.agents/logs/scan_report.md` (CLI Static Scan).
3. Read `.agents/logs/audit_logic_results.md` (AI Deep Logic Scan from Phase 2).

## 2. Performance, UI & SEO Scan

**Directive**: Evaluate frontend performance, design compliance, and SEO structures.
1. IF the project is a frontend web application (e.g., React, Next.js, Vite):
   - `> [LOAD SKILL] performance-audit`.
   - Extract metrics from `.agents/logs/audit_perf.md` (if previously run by CLI) OR deduce standard Core Web Vitals optimizations needed based on code structure.
   - **[Design Token Compliance]**: Detect hardcoded magic numbers in CSS/Tailwind (e.g., `#3a4f5c`, `27px`) and mandate consolidation into the Design System tokens.
   - **[SEO & Assets Audit]**: Evaluate the presence of proper OpenGraph Meta Tags and identify unoptimized large static asset patterns.
2. IF the project is strictly backend:
   - Skip performance web UI checks and focus on API response time architectures.

## 3. Interface Layer (Output Mandate)

**[STRICT RULE]**: You MUST generate the final report EXACTLY matching the structure below in **Traditional Chinese**.

> ## 專案全光譜健康報告 (Traffic Light Health Report)
>
> **1. 系統記憶狀態 (Memory Topology)**
> - 🟢 狀態：[例如：完美對齊] / 🔴 狀態：[例如：發現 3 個孤兒檔案]
> - 描述：[從 08-1 擷取的結果]
>
> **2. 架構與邏輯缺陷 (Architecture & Code Logic)**
> - 🟢/🟡/🔴 狀態：
> - 描述：[從 audit_logic_results.md 擷取的 API 缺口、死碼等結果]
>
> **3. 安全性審查 (S1-S5 Security)**
> - 🟢/🟡/🔴 狀態：
> - 描述：[從 audit_logic_results.md 擷取的資安掃描結果]
>
> **4. 資料庫效能與程式韌性 (DB Perf & Resilience)**
> - 🟢/🟡/🔴 狀態：
> - 描述：[從 audit_logic_results.md 擷取的 N+1 查詢、錯誤吞噬、競態條件等深層邏輯結果]
>
> **5. 靜態指標與 UI/UX 規範 (Static, UI/UX & SEO)**
> - 🟢/🟡/🔴 狀態：
> - 描述：[CLI ESLint/TS 狀態、Lighthouse 效能、Magic Numbers 抓漏與 SEO 狀態]
> 
> ### 💡 總監行動建議 (Next Steps)
> 1. [最高優先級的修復建議]
> 2. [次要優化建議]
