---
trigger: model_decision
description: 程式碼品質與安全合約。在撰寫、修改、或審查程式碼時適用。涵蓋機密隔離、驗證器鐵律、以及跨模組品質約束（安全、SOLID、UI/UX、測試）。
---

# [ANTIGRAVITY CODE QUALITY & SECURITY]

## 8. Credential & Environment Isolation (機密隔離)
- **Absolute Ban**: NEVER hard-code API keys, DB URLs, JWT Secrets. Extract via `process.env`.

## 9. Linter as Physical Law (驗證器鐵律)
- Linters and Unit Tests are physical execution barriers. Code that fails MUST be auto-rejected and fixed.

## 11. Cross-Cutting Quality Constraints (橫切品質約束)
The following constraints apply to ALL coding workflows. They are always active — no skill loading required.
- **Security**: All user input MUST be validated with schema validation (e.g., Zod). Never trust client-side data. Use parameterized queries for all database operations. Follow error handling standards: catch specific errors, log context, return safe messages.
- **Code Quality**: Follow SOLID principles. File length thresholds are dynamic — load `code-quality` skill for exact limits when writing new files. Prefer composition over inheritance.
- **UI/UX**: Engineering jargon MUST NOT leak into user-facing interfaces. Error messages MUST be human-readable and intent-driven. Load `ui-ux-standards` skill for full i18n and multi-language procedures.
- **Testing**: DOM element interactions MUST use stable selectors (`data-testid`, semantic roles). Never use fragile CSS selectors or XPath. Load `test-automation-strategy` skill for full E2E orchestration procedures.