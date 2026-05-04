---
name: audit-engine
description: >
  [Audit] Health audit semantic reasoning engine — AI-driven analysis for /08_audit_index §2 (S1–S5, API, test coverage, architecture).
  Use when: 執行 /08_audit_index 的語義推理審查（安全架構 S1–S5 / 前後端串接比對 / 測試覆蓋缺口 / 架構分析）。
  DO NOT use when: 執行 ESLint/npm audit 等工具掃描（用 code-audit）、非 /08_audit_index 工作流、修復或重構場景。
metadata:
  author: antigravity
  version: "1.0"
  origin: framework
  memory_awareness: read
  tool_scope: ["filesystem:read"]
---

# Audit Engine — Health Check Semantic Reasoning Engine

> **Caller**: `/08_audit_index` workflow | **Executor**: AI Master Agent (not CLI)
> **Mandate**: All steps in this skill are unconditionally enforced. No [SUDO] bypass permitted.

## 1. Trigger Conditions

Invoked exclusively by `/08_audit_index`. Not applicable to build, fix, or refactor workflows.

---

## 2. §1 — Backend Security Architecture Audit (S1–S5)

> **Prerequisite**: All backend API handler source files have been read.

```
[SECURITY AUDIT GATE] Enforce all checks — output PASS / FAIL + details / N/A per item:
│
├── S1: API Input Validation Coverage
│   Scan all backend API handlers → Does each endpoint have a Zod/Joi schema?
│   FAIL: Any endpoint missing schema → 🔴 Red, list missing endpoint paths
│
├── S2: Credential Isolation
│   Scan all source files → Any hardcoded API Key, DB URL, or JWT Secret?
│   FAIL: Any hardcoded credential found → 🔴 Red, list file path and line number
│
├── S3: Authentication Access Control
│   Scan all POST / PUT / DELETE routes → Role guard or overrideAccess present?
│   FAIL: Any write operation without guard → 🔴 Red, list unguarded routes
│
├── S4: Error Response Isolation
│   Scan error handlers → Does any API response expose stack traces or DB query strings?
│   FAIL: Any leak detected → 🔴 Red, list leak locations
│
└── S5: Structured Logging Standard
    Scan logging implementation → Is JSON structured format used (timestamp/level/module)?
    FAIL: Bare console.log usage found → 🟡 Yellow, list violating modules
```

**Output**: Write S1–S5 results to final report under【安全架構審查】section.

---

## 3. §2 — API Static Semantic Analysis (3-Layer Comparison)

> **Prerequisite**: API route definitions and frontend fetch/axios call source files have been read.

```
[API INTEGRITY GATE] Enforce three comparison layers:
│
├── Layer 1: Endpoint Existence
│   All frontend fetch/axios calls → Does each have a matching backend route?
│   FAIL: Frontend calls non-existent backend route → 🔴 Red, list missing routes
│
├── Layer 2: Dead API Detection
│   All backend routes → Does each have a matching frontend call?
│   WARNING: Route exists but no frontend call → 🟡 Yellow, list candidate dead endpoints
│
└── Layer 3: Schema Field Consistency
    For each matched endpoint, compare frontend payload fields vs backend Zod schema:
    - Field name mismatch → 🔴 Red, list mismatched fields and affected endpoints
    - Type mismatch (string vs number) → 🔴 Red
    - Frontend sends fields not defined in backend schema → 🟡 Yellow
```

**Output**: Write comparison results to final report under【前後端串接缺口】section.

---

## 4. §3 — Test Coverage Gap Analysis (4-Step Procedure)

> **Prerequisite**: All memory card `## Key Decisions` sections and test directory structure have been read.

```
[TEST COVERAGE AUDIT GATE] Enforce all four steps:
│
├── Step 1: Extract complete "critical business function" list
│           from all memory card ## Key Decisions sections
│
├── Step 2: Scan test directories (__tests__/ / *.spec.ts / *.test.ts)
│           Extract list of functions/endpoints already covered by tests
│
├── Step 3: Cross-compare → Output list of critical functions with zero test coverage
│
└── Step 4: Calculate uncovered rate (uncovered count ÷ total critical functions)
    ├── Uncovered rate > 50% → 🔴 Red
    ├── Uncovered rate 20–50% → 🟡 Yellow
    └── Uncovered rate < 20% → 🟢 Green

    List top 5 highest-risk uncovered functions (sorted by module dependency count)
```

**Output**: Uncovered rate + top-5 list → final report under【測試覆蓋缺口】section.

---

## 5. §4 — Memory-Driven Architecture Analysis

> **Prerequisite**: Memory card traversal complete (Phase B/E/F from §3 of the workflow).

Consolidates output from workflow §3.5 items B, E, F:

- **Module Relation Anomalies**: Actual import graph vs memory card Relations mismatch
- **Orphan File List**: Files not imported by any module (excluding known entry points)
- **Missing Key Functions**: Functions recorded in memory card Key Decisions no longer found via `grep_search`

---

## 6. Constraints

- **Exclusively invoked by `/08_audit_index`** — not applicable to build or fix flows
- **Does not perform tool scans** (ESLint/npm audit) — delegated to CLI + `Invoke-HealthAudit.ps1`
- **Does not perform memory card read/write** — memory traversal is handled by workflow §3
- **No [SUDO] exemption**: Commercial-grade audit does not permit skipping any check item
