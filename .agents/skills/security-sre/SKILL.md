---
name: security-sre
description: >
  Zero-trust validation, credential isolation procedures, and physical error handling/logging standards.
  Use when: 建構後端 API、處理資料庫寫入、設計認證流程、
  或任何涉及 安全/驗證/Zod/密碼/環境變數/error handling 的任務。
---

# Security & Reliability Engineering — Full Operating Protocol

## 1. Zero-Trust Validation (實體驗證器)

- NEVER trust incoming data (from APIs, DBs, or the Director's raw inputs).
- You MUST generate explicit physical validators (e.g., Zod, Joi, or custom validation schemas) for every incoming payload or DB write.
- Stop relying on type casting or assuming the runtime data matches the TypeScript interfaces.
- **Example**:
  ```typescript
  const CreatePostSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    status: z.enum(['draft', 'published']),
  });
  ```

## 2. Credential Isolation (機密隔離)

- **Absolute Ban**: NEVER hard-code API keys, database URLs, JWT Secrets, or any sensitive credentials into source files.
- You MUST force the architecture to extract these values via `process.env`.
- Ensure a `.env.example` file is maintained outlining the required environment variables:
  ```env
  # .env.example
  DATABASE_URI=
  PAYLOAD_SECRET=
  S3_BUCKET=
  S3_ACCESS_KEY_ID=
  S3_SECRET_ACCESS_KEY=
  ```

## 3. Physical Error Handling & Logging (實體錯誤處理)

- **Suppression Constraint**: NEVER expose internal stack traces or database query strings to the frontend UI/API responses.
- Catch errors gracefully and return standardized HTTP status codes and non-technical, human-readable JSON error messages:
  ```json
  { "error": "Internal server error. Please try again later." }
  ```
- **Backend Logging**: You MUST physically write error details and stack traces to a local log file (e.g., `/logs/error.log`) or standard output using a robust logging library (e.g., Winston, Pino) for debugging purposes.
