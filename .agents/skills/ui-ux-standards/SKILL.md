---
name: ui-ux-standards
description: >
  UI/UX design manifesto: engineering jargon isolation, multi-language strategy,
  human-readable error handling, and intent-driven interface design.
  Use when: 建構或修改前端 UI 元件、設計錯誤訊息、
  或任何涉及 UI/UX/介面/錯誤訊息/i18n/多語系/前端元件 的任務。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: none
  tool_scope: ["filesystem:read"]
---

# UI/UX & Multi-Language Standards — Full Operating Protocol

> This skill extends Core Mandate §11 (Cross-Cutting Quality Constraints) — UI/UX section.
> It provides concrete audience layering, translation lookup tables, and error message examples. Principle-level descriptions live in Core Mandate; this skill focuses on implementation specifics.

## 1. Engineering Jargon Isolation (工程語彙物理隔離)

### Technical Audience Persona (技術受眾宣告機制)

Before applying jargon isolation, determine the target user persona for the specific UI component:

- **Level 1 (B2C End-User)**: Absolute jargon isolation. Translate everything to pure user intent.
- **Level 2 (B2B Operator)**: Task-oriented precision. Domain jargon allowed, but ban low-level implementation details (e.g., allow "Invoice Status", ban "DB Timeout").
- **Level 3 (Developer/SysAdmin)**: Full transparency. Expose raw engineering specs and system exceptions for debugging.

### Forbidden Vocabulary (For Levels 1 & 2)

**Absolute Ban**: NEVER expose internal engineering terminology to the User Interface:
`CRUD`, `Query`, `Entity`, `Token`, `Payload`, `Auth`, `Fetch`, `Pending`, `Timeout`, `Deadlock`

### Intent-Driven Translation (意圖驅動翻譯)

All actions and statuses must be translated into the user's intent:

| ❌ Engineering Jargon | ✅ User Intent |
|----------------------|----------------|
| User Entity Created | Account created successfully |
| Authorization Pending | Awaiting approval |
| Failed to fetch data (Timeout) | Connection unstable. Please try again later. |

## 2. Multi-Language & Localization Strategy (多語系與在地化策略)

- **Dynamic Language Prompting**: Do NOT assume Traditional Chinese (zh-TW) is the default language for the UI. Before generating any user-facing text, you MUST ask the Director for the target language or check the project's i18n configurations.
- **Dictionary/Key-Based Approach**: Favor using localization keys (e.g., `common.buttons.submit`) over hardcoded strings in UI components, even for single-language projects, to future-proof the application.

## 3. Human-Readable Error Handling (白話文錯誤攔截)

When a backend service throws a technical exception, the UI MUST intercept it and display a non-threatening, actionable message in the target language:

| Technical Exception | English | Traditional Chinese |
|--------------------|---------|-------------------|
| `500 Internal Server Error` | Something went wrong. Please try again. | 系統暫時無法處理，請稍後再試。 |
| `Failed to fetch (Timeout)` | Connection unstable. Please try again later. | 目前連線不穩定，請稍後再試。 |
| `Invalid JWT Token` | For your security, please log in again. | 為了您的安全，請重新登入。 |
| `Database Deadlock` | We're processing your request. Please wait. | 正在處理您的請求，請稍候。 |

## 4. Intent-Driven UI & Graceful States (意圖驅動與優雅狀態)

- **Task-Oriented Flow**: Design layouts and flows based on what the user is trying to accomplish, not how the data is structured in the database.
- **Empty & Loading States**: Mandatory implementation of Skeleton Loading screens for data fetching. Empty states MUST never just say "No Data". They must include a Call to Action (CTA) in the appropriate language (e.g., "It looks empty here. Create your first project!").


