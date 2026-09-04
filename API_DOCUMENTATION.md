# GAVEL API Documentation

This documentation is designed for frontend developers and integration engineers. All API endpoints are prefixed with the base URL:
`http://localhost:5000/api/v1` (or your deployed server URL).

---

## 🔒 Authentication & Authorization

- **JWT Tokens & Cookies**: The API supports JWT Authorization headers (`Authorization: Bearer <token>`) as well as HTTP-Only cookies. When a user logs in, the backend issues access and refresh tokens.
- **Axios Setup**: Ensure `withCredentials: true` is set in your Axios instance so cookies are sent with requests.
- **Roles**: Available roles are `admin`, `judge`, `lawyer`, `clerk`, `litigant`, and `public`. Specific routes are restricted to designated roles.

---

## 1. Auth Module (`/auth`)

| Method | Endpoint | Auth Required | Request Body | Description |
|---|---|---|---|---|
| `POST` | `/auth/register` | No | `{ firstName, lastName, email, password, role?, phoneNumber?, barNumber? }` | Registers a new user (default role: `public`). |
| `POST` | `/auth/login` | No | `{ email, password }` | Authenticates user credentials and returns tokens/cookies. |
| `POST` | `/auth/logout` | Yes | - | Logs out the user and clears authentication session. |
| `POST` | `/auth/refresh-token`| No | - | Generates a new access token using a valid refresh token. |
| `GET` | `/auth/me` | Yes | - | Retrieves details of the currently authenticated user. |
| `POST` | `/auth/forgot-password`| No | `{ email }` | Sends password reset token to user's registered email. |
| `POST` | `/auth/reset-password/:token` | No | `{ password }` | Resets password using the token sent via email. |
| `GET` | `/auth/verify-email/:token` | No | - | Validates email address token. |
| `POST` | `/auth/resend-verification` | No | `{ email }` | Resends a fresh email verification token to the user. |

---

## 2. Cases Module (`/cases`)

| Method | Endpoint | Auth Required | Body / Query | Description |
|---|---|---|---|---|
| `GET` | `/cases` | Yes | `?page=1&limit=10&status=Active&stage=Trial` | Fetches a paginated list of cases. Auto-filtered by role. |
| `POST` | `/cases` | Admin / Clerk | `{ caseNumber, title, description, court, stage, status, isProBono }` | Creates a new case record. |
| `GET` | `/cases/export` | Admin / Judge | `?format=pdf&caseId=...` or `?format=csv` | Exports cases as CSV (all) or PDF (single case). |
| `POST` | `/cases/bulk-import` | Admin / Clerk | `FormData: { file: File }` | Uploads a CSV file for bulk case creation. |
| `GET` | `/cases/:id` | Yes | - | Fetches full details of a specific case, populating assigned lawyers and judges. |
| `PATCH`| `/cases/:id` | Admin / Clerk / Judge | `{ title, description, court, stage, status... }` | Updates general case information. |
| `DELETE`| `/cases/:id` | Admin | - | Deletes a case and its audit history. |
| `POST` | `/cases/:id/status` | Admin / Clerk / Judge | `{ stage, status, stallReason, comments }` | Updates case status and records an immutable audit log entry. |
| `GET` | `/cases/:id/audit-log` | Yes | - | Retrieves the case `StatusHistory` timeline. |
| `GET` | `/cases/:id/qr-slip` | Yes | - | Generates a Base64 QR code image for verifying the case. |

---

## 3. Documents Module (Case Attachments)

| Method | Endpoint | Auth Required | Request Body | Description |
|---|---|---|---|---|
| `GET` | `/cases/:id/documents` | Yes | - | Fetches all uploaded document attachments for a case. |
| `POST` | `/cases/:id/documents` | Admin / Clerk / Lawyer | `FormData: { file: File, description: String }` | Uploads a file attachment for a specific case. |
| `DELETE`| `/documents/:id` | Yes | - | Deletes document metadata and physical stored file. |

---

## 4. Public Module (`/public`)
*No authentication required. All responses are sanitized to strip Personally Identifiable Information (PII).*

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/public/cases/:caseHashId` | No | Fetches a sanitized public version of a case (no names shown). |
| `GET` | `/public/scorecard` | No | System-wide statistics (Total, Active, Resolved cases, Resolution Rate). |
| `GET` | `/public/backlog-map` | No | Aggregates active and stalled cases by court jurisdiction. |
| `GET` | `/public/trends` | No | Time-series filing and resolution data grouped by month/year. |

---

## 5. Watch Subscriptions (`/watch`)
*Public users can subscribe to real-time status updates for specific cases.*

| Method | Endpoint | Auth Required | Request Body | Description |
|---|---|---|---|---|
| `POST` | `/watch/:caseHashId` | No | `{ email }` | Subscribes an email to case update notifications. |
| `DELETE`| `/watch/:idOrToken` | No | - | Unsubscribes from notifications using secure token or ID. |

---

## 6. Pro-Bono Module (`/pro-bono`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/pro-bono/cases` | Lawyer Only | Fetches unassigned cases marked `isProBono: true`. |
| `POST` | `/pro-bono/cases/:id/claim` | Lawyer Only | Claims an unassigned pro-bono case for legal representation. |
| `GET` | `/pro-bono/my-claimed` | Lawyer Only | Fetches all pro-bono cases claimed by the logged-in lawyer. |

---

## 7. Admin Analytics Module (`/analytics`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/analytics/overview` | Admin Only | High-level system metrics (case totals, user role breakdowns). |
| `GET` | `/analytics/heatmap` | Admin Only | Identifies court congestion bottlenecks aggregated by `court` and `stage`. |
| `GET` | `/analytics/trends` | Admin Only | Parses `StatusHistory` audit logs to calculate month-over-month transitions. |

---

## 8. User Management (`/users`)

| Method | Endpoint | Auth Required | Request Body / Query | Description |
|---|---|---|---|---|
| `GET` | `/users` | Admin Only | `?role=lawyer&page=1&limit=20` | Paginated list of users (filterable by role). |
| `POST` | `/users/invite` | Admin Only | `{ email, firstName, lastName, role, court }` | Creates user account with auto-generated temp password and sends invite email. |
| `PATCH` | `/users/:id` | Admin Only | `{ firstName, lastName, role, court, isEmailVerified }` | Updates user details or role permissions. |
| `DELETE`| `/users/:id` | Admin Only | - | Permanently deletes a user account. |

---

## 9. System Health (`/health`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/health` | No | System health check returning `{ status: 'UP', timestamp: ... }`. |

---

## Standard API Response Format

**Success Response (2xx):**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error Response (4xx / 5xx):**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (dev mode only)",
  "stack": "Stack trace (dev mode only)"
}
```
