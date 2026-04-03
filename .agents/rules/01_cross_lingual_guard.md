---
trigger: always_on
---

# [CROSS-LINGUAL REASONING GUARD]

## Activation Scope

```
Chinese input received?
├── Trivial (≤5 chars: 繼續/GO/好/對/確認) → Skip all phases
└── Non-trivial → Apply Three-Tier Read Strategy below
```

## Three-Tier Read Strategy (三級快取策略)

- 🧊 **Cold Start (冷啟動)**: VERY FIRST non-trivial Chinese input in a NEW conversation
  → call `view_file` on `cross-lingual-guard` SKILL.md FIRST (before any text output)
  → output template from the loaded content
  → This is a **MANDATORY TOOL ACTION** — cannot be skipped or deferred
  → The thought token may render once; this is the accepted trade-off for reliable cold-start activation

- 🔥 **Warm Cache (暖快取)**: Subsequent Chinese inputs in the SAME conversation (<50 turns)
  → Output template below directly from memory, skip `view_file`

- ⚠️ **Drift Guard (漂移防護)**: Conversation ≥50 turns, OR Agent suspects format drift
  → Re-read `cross-lingual-guard` SKILL.md AFTER template output

## Execution Steps (Warm Cache Path)

1. **Defer to Native Thought**: Execute IDE-native internal thought block first.
2. **Output template from memory** (below). Do NOT call `view_file` before this — any tool before the template breaks the IDE thought token.
3. **Proceed directly** after outputting the template. The template IS the transparency mechanism — the Director reviews it and corrects if needed. Do NOT self-assess confidence or gate on echo-back.
4. For write-enabled workflows (/02, /03, /04, /05, /09, /10, /12): double-check your Phase 1 interpretation before executing any destructive action.

## Heuristic Safety Triggers (安全觸發器 — 強制降為 LOW)

Override self-assessed confidence to LOW when ANY condition matches:

- Write-Enabled workflow is active (e.g. /02, /03, /04, /05, /09, /10, /12)
- Negation + degree modifier: 不太/不是很/並非完全/也不算
- Abstract concept with no concrete referent in input
- Reference to prior context without specifics: 你剛說的/之前的/上次那個
- Input >80 chars with no explicit action verb
- Complex conditional: 如果...就.../除非...否則.../只要...但是...
- Multiple possible interpretations exist for a key phrase
- Director previously corrected a similar interpretation in this session

## Memory-Embedded Output Template (記憶模板)

Output this block verbatim after native thought. No tool call needed for warm cache.

```
> <details>
> <summary>🧠 跨語系思維解析 (點擊展開)</summary>
>
> **Phase 0: Workflow Context Awareness**
> - **Trigger**: [填寫觸發來源 (繁體中文)]
> - **Role**: [填寫目前的 Agent 角色 (繁體中文)]
> - **Scope Constraints**: [填寫當前的限制與守備範圍 (繁體中文)]
>
> **Phase 1: 4-Layer Intent Decode**
> - **Layer 1 (字面)**: [填寫字面意義]
> - **Layer 2 (意圖)**: [填寫總監意圖]
> - **Layer 3 (情緒)**: [填寫語氣與情緒]
> - **Layer 4 (隱含)**: [填寫隱含假設]
> </details>

<br>
```
