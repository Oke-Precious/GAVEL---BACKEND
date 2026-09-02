# GAVEL API Documentation

This documentation is designed for the Frontend development team. All endpoints are prefixed with the base URL:
`http://localhost:1940/api/v1` (or your deployed URL).

---

## 🔒 Authentication & Authorization

- **JWT Cookies**: The API uses HTTP-Only cookies for authentication. When a user logs in, the backend sends a `jwt` (Access Token) and `jwt-refresh` (Refresh Token) cookie.
- **Axios Setup**: Ensure that you include `withCredentials: true` in your Axios configuration so cookies are sent with every request!
- **Roles**: Available roles are `admin`, `judge`, `lawyer`, `clerk`, `litigant`, and `public`. Certain routes are scoped to specific roles.

---

## 1. Auth Module (`/auth`)

| Method | Endpoint | Auth Required | Body | Description |
|---|---|---|---|---|
| `POST` | `/auth/register` | No | `{ firstName, lastName, email, password, role }` | Registers a new user (default role: `public`). |
| `POST` | `/auth/login` | No | `{ email, password }` | Authenticates user and sets HTTP-Only cookies. |
| `POST` | `/auth/logout` | Yes | - | Clears JWT cookies. |
| `POST` | `/auth/refresh-token`| No | - | Uses `jwt-refresh` cookie to issue a new access token. |
| `GET` | `/auth/me` | Yes | - | Returns the currently authenticated user's details. |
| `POST` | `/auth/forgot-password`| No | `{ email }` | Triggers a password reset email with a token. |
| `POST` | `/auth/reset-password/:token` | No | `{ password }` | Resets the password using the token sent to email. |
| `GET` | `/auth/verify-email/:token` | No | - | Verifies the user's email address. |

---

## 2. Cases Module (`/cases`)

| Method | Endpoint | Auth Required | Body / Query | Description |
|---|---|---|---|---|
| `GET` | `/cases` | Yes | `?page=1&limit=10&status=Active` | Fetches a paginated list of cases. Auto-filtered by role (e.g. Lawyers only see cases they are mapped to). |
| `POST` | `/cases` | Yes (Admin/Clerk) | `{ title, description, court, isProBono... }` | Creates a new case. |
| `GET` | `/cases/:id` | Yes | - | Fetches full details of a specific case, populating assigned lawyers and judges. |
| `PATCH`| `/cases/:id` | Yes (Admin/Clerk/Judge) | `{ title, description, ... }` | Updates general case information. |
| `DELETE`| `/cases/:id` | Yes (Admin) | - | Hard deletes a case and all associated audit logs. |
| `POST` | `/cases/:id/status` | Yes (Admin/Clerk/Judge) | `{ stage, status, stallReason, comments }` | Updates case status and creates an immutable audit log. |
| `GET` | `/cases/:id/audit-log` | Yes | - | Retrieves the `StatusHistory` (timeline of state changes). |
| `GET` | `/cases/export` | Yes (Admin/Judge) | `?format=pdf&caseId=...` | Downloads cases as CSV (all) or PDF (single case). |
| `POST` | `/cases/bulk-import` | Yes (Admin/Clerk) | `FormData: { file: File }` | Upload a CSV file to bulk insert cases. |
| `GET` | `/cases/:id/qr-slip` | Yes | - | Returns a Base64 QR Code image for the case hash. |

---

## 3. Documents Module (Case Attachments)

| Method | Endpoint | Auth Required | Body | Description |
|---|---|---|---|---|
| `GET` | `/cases/:id/documents` | Yes | - | Fetches all documents attached to a specific case. |
| `POST` | `/cases/:id/documents` | Yes (Admin/Clerk/Lawyer) | `FormData: { file: File, description: String }` | Uploads a physical file attached to the case. |
| `DELETE`| `/documents/:id` | Yes (Admin / Uploader) | - | Deletes the document metadata and physical file. |

---

## 4. Public Module (`/public`)
*No authentication required. Data is heavily sanitized to prevent PII (Personally Identifiable Information) leaks.*

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/public/cases/:caseHashId` | No | Fetches a sanitized public version of a case (no names shown). |
| `GET` | `/public/scorecard` | No | Returns system-wide aggregates (Total, Active, Resolved, Resolution Rate). |
| `GET` | `/public/backlog-map` | No | Groups active and stalled cases by court jurisdiction. |
| `GET` | `/public/trends` | No | Time-series data grouping case filings and resolutions by Month/Year. |

---

## 5. Watch Subscriptions (`/watch`)
*Allows public users to subscribe to case updates via email.*

| Method | Endpoint | Auth Required | Body | Description |
|---|---|---|---|---|
| `POST` | `/watch/:caseHashId` | No | `{ email }` | Subscribes an email address to a case. |
| `DELETE`| `/watch/:idOrToken` | No | - | Unsubscribes using the secure token sent to their email. |

---

## 6. Pro-Bono Module (`/pro-bono`)

| Method | Endpoint | Auth Required | Query | Description |
|---|---|---|---|---|
| `GET` | `/pro-bono/cases` | Yes (Lawyer) | `?minDetentionDays=30` | Fetches cases marked `isProBono: true` that have no assigned lawyers. |
| `POST` | `/pro-bono/cases/:id/claim` | Yes (Lawyer) | - | Claims an unrepresented case, adding the lawyer to the case and writing an audit log. |
| `GET` | `/pro-bono/my-claimed` | Yes (Lawyer) | - | Fetches pro-bono cases claimed by the currently authenticated lawyer. |

---

## 7. Admin Analytics Module (`/analytics`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/analytics/overview` | Yes (Admin) | Returns high-level system metrics (total cases, users by role). |
| `GET` | `/analytics/heatmap` | Yes (Admin) | Identifies bottlenecks by aggregating cases by `court` and `stage`. |
| `GET` | `/analytics/trends` | Yes (Admin) | Parses `StatusHistory` to show month-over-month transitions (e.g., how many stalled). |

---

## 8. User Management (`/users`)

| Method | Endpoint | Auth Required | Body | Description |
|---|---|---|---|---|
| `GET` | `/users` | Yes (Admin) | - | Paginated list of all users. |
| `POST` | `/users/invite` | Yes (Admin) | `{ firstName, lastName, email, role }` | Creates a user with a random temporary password and emails them their credentials. |
| `PATCH` | `/users/:id` | Yes (Admin) | `{ role, isActive... }` | Updates a user's details. |
| `DELETE`| `/users/:id` | Yes (Admin) | - | Permanently deletes a user. |

---

## 9. System (`/health`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/health` | No | Lightweight endpoint returning `{ status: 'UP' }` for load balancers. |

---

## Standard API Response Format

The backend utilizes a standardized JSON response format.

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
