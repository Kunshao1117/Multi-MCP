---
name: code-quality
description: >
  [Quality] Imperative code quality enforcement via Silent Exception gates: SOLID, dynamic line thresholds, modular refactoring.
  Use when: 建構新原始碼檔案、執行 /05_refactor 重構、或檔案行數可能超過閾值 的場景。
  DO NOT use when: 純討論/研究/讀取程式碼、修改設定檔或樣式文字、/03-1_experiment 沙盒模式。
metadata:
  author: antigravity
  version: "6.0"
  origin: framework
  memory_awareness: none
  tool_scope: ["filesystem:read"]
---

# Code Quality Standards — Imperative Enforcement Protocol

## 0. Override & Sandbox Detection (特權與沙盒偵測)

```
[OVERRIDE GATE] Check execution context BEFORE any quality enforcement:
├── Director prompt contains [SUDO]?
│   └── YES → Skip ALL quality gates. Proceed without constraints.
├── Active workflow is /03_sketch?
│   └── YES → Skip ALL quality gates. Sandbox environment.
└── NO to both → Enforce all gates below strictly.
```

## 1. SOLID Alignment Gate (SOLID 原則閘門)

```
[SOLID GATE] For EVERY function or class written/modified:
├── Single Responsibility: Does it do exactly ONE thing?
│   ├── YES → Proceed silently.
│   └── NO  → Internally split before committing. No output.
├── Composition over Inheritance: Using extends/inherit?
│   ├── Justified (framework requirement) → Proceed silently.
│   └── Unjustified → Refactor to composition internally.
└── All checks pass → Continue to next gate.
```

## 2. Dynamic File Thresholds (動態檔案閾值)

| File Type           | Max Lines | Examples                         |
| ------------------- | --------- | -------------------------------- |
| Utils / Services    | 200 lines | `auth-service.ts`, `utils.ts`    |
| Components / Pages  | 500 lines | `PostsPage.tsx`, `Editor.tsx`    |
| Routes / DI Configs | No limit  | `routes.ts`, `payload.config.ts` |

## 3. Threshold Enforcement Gate (閾值強制閘門)

```
[THRESHOLD GATE] AFTER writing or modifying ANY file:
├── Count total lines of target file.
├── Look up threshold from table above.
├── Compare:
│   ├── lines ≤ threshold → Proceed silently. Zero output.
│   └── lines > threshold →
│       ├── IMMEDIATELY stop all current work.
│       ├── Output: 「🔴 [QUALITY HALT] {filename} 超過 {threshold} 行 ({actual} 行)。啟動強制拆分。」
│       └── Invoke /05_refactor autonomously.
└── Gate cleared → Proceed.
```

## Constraints

- This skill operates SILENTLY. Do NOT output confirmation when checks pass.
- Output ONLY when a violation is detected (Exception-Halt pattern).
- [SUDO] and /03_sketch bypass ALL gates.
