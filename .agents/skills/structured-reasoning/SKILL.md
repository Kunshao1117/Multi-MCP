---
name: structured-reasoning
description: >
  [Infra] Sequential Thinking deep reasoning workflow: architecture decisions, debugging, multi-option analysis.
  Use when: 需要 深度推理/架構決策/除錯分析/多方案比較 的複雜場景。
  DO NOT use when: 簡單問答/事實查詢/單一選項決策/不需要多步推理的場景。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: none
  mcp_servers: [sequentialthinking]
  tool_scope: ["mcp:sequentialthinking"]
---

# Structured Reasoning (結構化推理)

## Trigger Conditions (觸發條件)

```
Task complexity?
├── Architecture decision with multiple trade-offs → Use
├── Deep debugging requiring multi-layer analysis → Use
├── Multi-option comparison → Use
└── Simple Q&A / fact lookup / creative writing → Do NOT use
```

## Procedure (操作流程)

### 0. PRECONDITION (前置強制約束)

[CONSTRAINT] YOU ARE FORBIDDEN FROM SIMULATING THOUGHTS IN PLAIN TEXT.
[CONSTRAINT] YOU MUST INVOKE THE PHYSICAL MCP TOOL.

### 1. INITIALIZATION (強制初始化)

[EXECUTE_TOOL] mcp:sequentialthinking
[PARAMETERS_REQUIRED]
- `totalThoughts`: Evaluate complexity, set between 5-15.
- `thoughtNumber`: 1
- `nextThoughtNeeded`: true

[ASSERT] DO NOT GENERATE ANY OTHER TEXT RESPONSE IN THIS TURN. ONLY INVOKE THE TOOL.

### 2. ITERATION (迴圈強制執行)

[EXECUTE_TOOL_LOOP] mcp:sequentialthinking
[ACTION] Increment `thoughtNumber`.
[ASSERT] IF MORE THOUGHTS NEEDED: `nextThoughtNeeded`: true
[ASSERT] IF BRANCHING/REVISING: Apply `isRevision` or `branchFromThought` flags.

### 3. CONCLUSION (強制收網)

[FINAL_TOOL_CALL_ASSERT]
[ASSERT] Hypothesis VERIFIED -> set `nextThoughtNeeded`: false.
[MANDATORY_OUTPUT] Wait for tool signal. ONLY AFTER TOOL COMPLETION, present final actionable recommendation to Director.

## Constraints (約束)

- Keep `totalThoughts` as low as practical — long chains consume context
- FORBIDDEN: invoking for tasks resolvable with direct reasoning

## Done When (驗證標準)

- Final thought: `nextThoughtNeeded: false`
- Conclusion: clear, actionable recommendation
- Token investment justified by analysis quality
