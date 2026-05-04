---
name: ui-ux-standards
description: >
  [Quality] UI/UX design manifesto: engineering jargon isolation, multi-language strategy,
  human-readable error handling, and intent-driven interface design.
  Use when: 建構或修改前端 UI 元件、設計錯誤訊息、
  或任何涉及 UI/UX/介面/錯誤訊息/i18n/多語系/前端元件 的任務。
  DO NOT use when: 純後端 API 開發（用 security-sre）、不涉及使用者介面的場景。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: none
  tool_scope: ["filesystem:read"]
---

# UI/UX & Multi-Language Standards — Full Operating Protocol

## 1. Engineering Jargon Isolation (工程語彙物理隔離)

### Target Audience Decision Tree

```
UI component target audience?
├── L1 (B2C End-User) → Absolute jargon isolation. Pure user intent language.
├── L2 (B2B Operator) → Domain jargon allowed. Ban implementation details.
└── L3 (Developer/SysAdmin) → Full transparency. Raw engineering specs.
```

### Forbidden Vocabulary (For Levels 1 & 2)

**Absolute Ban**: NEVER expose internal engineering terminology to the User Interface:
`CRUD`, `Query`, `Entity`, `Token`, `Payload`, `Auth`, `Fetch`, `Pending`, `Timeout`, `Deadlock`

### Intent-Driven Translation (意圖驅動翻譯)

All actions and statuses must be translated into the user's intent:

| ❌ Engineering Jargon          | ✅ User Intent                               |
| ------------------------------ | -------------------------------------------- |
| User Entity Created            | Account created successfully                 |
| Authorization Pending          | Awaiting approval                            |
| Failed to fetch data (Timeout) | Connection unstable. Please try again later. |

## 2. Multi-Language & Localization Strategy (多語系與在地化策略)

1. MUST check project i18n configuration or ask Director for target language BEFORE generating UI text
2. Use localization keys (e.g., `common.buttons.submit`) over hardcoded strings, even for single-language projects

## 3. Human-Readable Error Handling (白話文錯誤攔截)

When a backend service throws a technical exception, the UI MUST intercept it and display a non-threatening, actionable message in the target language:

| Technical Exception         | English                                      | Traditional Chinese            |
| --------------------------- | -------------------------------------------- | ------------------------------ |
| `500 Internal Server Error` | Something went wrong. Please try again.      | 系統暫時無法處理，請稍後再試。 |
| `Failed to fetch (Timeout)` | Connection unstable. Please try again later. | 目前連線不穩定，請稍後再試。   |
| `Invalid JWT Token`         | For your security, please log in again.      | 為了您的安全，請重新登入。     |
| `Database Deadlock`         | We're processing your request. Please wait.  | 正在處理您的請求，請稍候。     |

## 4. Intent-Driven UI & Graceful States (意圖驅動與優雅狀態)

1. Design layouts by **user task**, NOT by database structure
2. MUST implement Skeleton Loading for data fetching
3. Empty states MUST include a Call to Action (CTA) — FORBIDDEN: 「No Data」 alone

## 5. Color Palette Gate (色碼品質閘門)

```
[COLOR GATE] Before committing ANY CSS/styled-component:
├── Scan for raw primary hex: #FF0000, #00FF00, #0000FF, #FFFF00, #FF00FF, #00FFFF
│   ├── Match found → Self-correct to HSL/design-token internally.
│   │   DO NOT output. Fix silently.
│   └── No match → Proceed silently.
└── Gate cleared.
```
