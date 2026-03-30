---
name: code-quality
description: >
  SOLID principle alignment, dynamic file line thresholds, and code style enforcement.
  Use when: 建構新程式碼、重構既有程式碼、
  或任何涉及 SOLID/閾值/行數/refactor/程式碼品質 的任務。
---

# Code Quality Standards — Full Operating Protocol

> This skill extends Core Mandate §11 (Cross-Cutting Quality Constraints) — Code Quality section.
> It provides concrete line thresholds and execution details. Principle-level descriptions live in Core Mandate; this skill focuses on implementation specifics.

## 1. SOLID Alignment (SOLID 原則對齊)

- Code MUST adhere to SOLID principles. Favor composition over inheritance. Ensure single-responsibility functions.

## 2. Dynamic File Thresholds (動態檔案閾值)

Different file types have different maximum line limits:

| File Type | Max Lines | Examples |
|-----------|-----------|----------|
| Utils / Services (Core Logic) | 200 lines | `auth-service.ts`, `utils.ts` |
| Components / Pages (UI/JSX) | 500 lines | `PostsPage.tsx`, `Editor.tsx` |
| Routes / DI Configs (Declarative) | No limit | `routes.ts`, `payload.config.ts` |

## 3. Threshold Enforcement (閾值執行)

- If a file exceeds its respective threshold, you MUST immediately propose and execute a modular refactoring plan.
- Refactoring strategy: Split oversized files into smaller, focused modules maintaining single responsibility.
