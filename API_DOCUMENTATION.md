# GAVEL API Documentation

This documentation is designed for frontend developers and integration engineers. All API endpoints are prefixed with the base URL:

> **Local:** `http://localhost:1940/api/v1`
> **Production:** `https://gavel-backend-nw0p.onrender.com/api/v1`

---

## 🚀 Quick Start (Dev Setup)

```bash
# 1. Install dependencies
npm install

# 2. Seed the database with demo users and sample cases
npm run seed

# 3. Start dev server (with auto-reload)
npm run dev

# 4. Run unit tests
npm test
```

### Demo Accounts (after seeding)
All accounts share the password: **`Password123!`**

| Role | Email | Notes |
|---|---|---|
| `admin` | admin@gavel.app | Full system access |
| `judge` | judge@gavel.app | Assigned cases scoped automatically |
| `lawyer` | lawyer@gavel.app | Can claim pro-bono cases |
| `clerk` | clerk@gavel.app | Case filing & document uploads |
| `litigant` | litigant@gavel.app | Limited read access |

---

## 🔒 Authentication & Authorization

- **JWT Bearer Token**: Send `Authorization: Bearer <accessToken>` in request headers.
- **HTTP-Only Cookie**: A `refreshToken` cookie is set automatically on login. Ensure `withCredentials: true` is configured in your HTTP client (e.g. Axios).
- **Roles**: `admin`, `judge`, `lawyer`, `clerk`, `litigant`, `public`. Role-restricted routes return `403` if the user's role is not permitted.
- **Token Expiry**: Access tokens expire in **30 minutes**. Use `POST /auth/refresh-token` to obtain a new one.

### Recommended Axios Setup
```js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:1940/api/v1',
  withCredentials: true, // Required for refresh token cookie
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

---

## 🌐 CORS — Allowed Origins

The following frontend origins are allowed without any extra configuration:

- `http://localhost:5173` (Vite default)
- `http://localhost:3000` (React / Next.js default)
- `http://localhost:5174`
- `http://localhost:8080`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:3000`
- Any URL set in the `CLIENT_URL` environment variable (production)

> **Note:** In non-production (`NODE_ENV !== 'production'`), all origins are allowed automatically for local development convenience.

---

## 1. Auth Module (`/auth`)

| Method | Endpoint | Auth Required | Request Body | Description |
|---|---|---|---|---|
| `POST` | `/auth/register` | No | `{ firstName, lastName, email, password, role?, phoneNumber?, barNumber? }` | Registers a new user. Default role is `public`. Sends a verification email. |
| `POST` | `/auth/login` | No | `{ email, password }` | Authenticates user and returns `accessToken`, `refreshToken`, and sets `refreshToken` HTTP-only cookie. |
| `POST` | `/auth/logout` | Yes | — | Clears refresh token from DB and cookie. |
| `POST` | `/auth/refresh-token` | No | `{ refreshToken? }` (or via cookie) | Issues a new access + refresh token pair (token rotation). Send either via cookie or JSON body. |
| `GET` | `/auth/me` | Yes | — | Returns the authenticated user's profile. |
| `POST` | `/auth/forgot-password` | No | `{ email }` | Sends a password reset link to the email. Always returns success to prevent enumeration. |
| `POST` | `/auth/reset-password/:token` | No | `{ password }` | Resets the user's password. Token is valid for **10 minutes**. |
| `GET` | `/auth/verify-email/:token` | No | — | Verifies email address. **Browser requests redirect to `CLIENT_URL/login?verified=true`**. API calls (non-HTML `Accept` headers) get JSON. |
| `POST` | `/auth/resend-verification` | No | `{ email }` | Resends verification email. |

### Login Response Example
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "_id": "...", "firstName": "System", "role": "admin", ... },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

> ⚠️ **Important:** Store the `accessToken` in memory or `localStorage`. The `refreshToken` is also sent in the JSON body for clients that don't support cookies (e.g. React Native). On web, prefer the HTTP-only cookie.

---

## 2. Cases Module (`/cases`)

All routes require authentication (`Authorization: Bearer <token>`).

| Method | Endpoint | Auth Required | Body / Query | Description |
|---|---|---|---|---|
| `GET` | `/cases` | Yes | `?page=1&limit=10&status=Active&stage=Trial` | Paginated list. Auto-scoped: judges see only their cases, lawyers see cases they're assigned to. |
| `POST` | `/cases` | Admin / Clerk | `{ caseNumber, title, description?, court?, stage?, status?, isProBono?, plaintiffs?, defendants?, detentionDate? }` | Creates a new case. A unique `hashId` (`GAV-YY-XXXXXX`) is auto-generated. |
| `GET` | `/cases/export` | Admin / Judge | `?format=csv` or `?format=pdf&caseId=<id>` | Downloads CSV (all cases) or PDF (single case by MongoDB ID). |
| `POST` | `/cases/bulk-import` | Admin / Clerk | `FormData: { file: .csv }` | Bulk creates cases from a CSV file. Supports quoted fields. Required CSV headers: `caseNumber`, `title`. |
| `GET` | `/cases/:id` | Yes | — | Fetches a single case by MongoDB `_id`. Populates `lawyers` and `judge` with names and emails. |
| `PATCH` | `/cases/:id` | Admin / Clerk / Judge | `{ title?, description?, court?, plaintiffs?, defendants? }` | Updates case details. `stage` and `status` are **ignored** here — use `/status` endpoint instead. |
| `DELETE` | `/cases/:id` | Admin | — | Permanently deletes a case and its entire `StatusHistory`. |
| `POST` | `/cases/:id/status` | Admin / Clerk / Judge | `{ stage?, status?, stallReason?, comments? }` | Updates case stage/status and writes an immutable audit log entry. |
| `GET` | `/cases/:id/audit-log` | Yes | — | Returns full `StatusHistory` for the case, including who changed what and when. |
| `GET` | `/cases/:id/qr-slip` | Yes | — | Returns a Base64 PNG `data:image/...` QR code linking to the public case page. |

### Bulk Import CSV Format
```csv
caseNumber,title,court,stage,status,isProBono
FHC/001/2026,"Land Dispute Case","Lagos High Court",Pre-Trial,Active,false
```

---

## 3. Documents Module (Case Attachments)

| Method | Endpoint | Auth Required | Request Body | Description |
|---|---|---|---|---|
| `GET` | `/cases/:id/documents` | Yes | — | Lists all uploaded documents for a case. Each document includes `fileUrl` accessible via `/uploads/<filename>`. |
| `POST` | `/cases/:id/documents` | Admin / Clerk / Lawyer | `FormData: { file: File, description?: String }` | Uploads a file. Stored on disk. Returns full document metadata. |
| `DELETE` | `/documents/:id` | Yes | — | Deletes document DB record and physical file. Only admin or the original uploader can delete. |

> **Accessing Files:** Documents are served statically. Prepend the backend URL to `fileUrl`:
> `http://localhost:1940/uploads/<filename>`

---

## 4. Public Module (`/public`)

*No authentication required. All responses are sanitized — **no names, emails, or PII** are ever returned.*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/public/cases/:caseHashId` | Fetches a public case by its `hashId` (format: `GAV-26-XXXXXX`). Returns: `caseNumber`, `title`, `description`, `stage`, `status`, `court`, `filingDate`, `hashId` only. |
| `GET` | `/public/scorecard` | System-wide statistics: `totalCases`, `activeCases`, `resolvedCases`, `stalledCases`, `resolutionRate` (%). |
| `GET` | `/public/backlog-map` | Active + stalled case counts grouped by `court`. Sorted by total backlog descending. |
| `GET` | `/public/trends` | Monthly filing and resolution counts. Each item: `{ period: "2026-01", filed: 5, resolved: 2 }`. |

> ⚠️ `GET /public/cases/:caseHashId` uses the **hashId** (e.g. `GAV-26-8A3F9`), **not** the MongoDB `_id`.

---

## 5. Watch Subscriptions (`/watch`)

Public users can subscribe to email alerts when a case status changes.

| Method | Endpoint | Auth Required | Request Body | Description |
|---|---|---|---|---|
| `POST` | `/watch/:caseHashId` | No | `{ email }` | Subscribes an email to a case. Returns `{ unsubscribeToken }` — save this to allow the user to unsubscribe later. |
| `DELETE` | `/watch/:idOrToken` | No | — | Unsubscribes using either the `unsubscribeToken` or the subscription MongoDB `_id`. |

### Subscribe Response Example
```json
{
  "success": true,
  "message": "Successfully subscribed to case updates",
  "data": {
    "unsubscribeToken": "a3f9e2b1..."
  }
}
```

---

## 6. Pro-Bono Module (`/pro-bono`)

Accessible to authenticated users with the `lawyer` role only.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/pro-bono/cases` | Lists unrepresented pro-bono cases (`isProBono: true`, `lawyers: []`). Filter: `?minDetentionDays=30` to show cases where the accused has been detained for at least N days. Sorted by longest detention first. |
| `POST` | `/pro-bono/cases/:id/claim` | Claims a pro-bono case. Adds the lawyer to `lawyers` array and writes an audit log. Returns `403` if already claimed. |
| `GET` | `/pro-bono/my-claimed` | Returns all pro-bono cases claimed by the authenticated lawyer. |

---

## 7. Admin Analytics Module (`/analytics`)

Accessible to `admin` role only.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/analytics/overview` | Total/active/pro-bono case counts + user totals and role distribution. |
| `GET` | `/analytics/heatmap` | Case count grouped by `{ court, stage }`. Excludes `Closed` cases. Useful for court congestion maps. |
| `GET` | `/analytics/trends` | Monthly breakdown of status transitions from `StatusHistory`. Each item: `{ _id: { year, month, status }, count }`. |

---

## 8. User Management (`/users`)

Accessible to `admin` role only.

| Method | Endpoint | Request Body / Query | Description |
|---|---|---|---|
| `GET` | `/users` | `?role=lawyer&page=1&limit=20` | Paginated list of all users, filterable by role. |
| `POST` | `/users/invite` | `{ email, firstName, lastName, role, court? }` | Creates an account with a secure auto-generated temp password and sends an invite email. Account is pre-verified. |
| `PATCH` | `/users/:id` | `{ firstName?, lastName?, role?, phoneNumber?, isActive? }` | Updates user fields. Cannot update `password` through this endpoint. |
| `DELETE` | `/users/:id` | — | Permanently deletes a user. Prevents self-deletion and deletion of the last admin. |

---

## 9. System Health

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/health` | No | Returns `{ status: 'UP', timestamp: <ms> }`. Use for uptime/ping checks. |

---

## Standard API Response Format

### Success Response (`2xx`)
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Validation Error Response (`422`)
Returned when request body fails validation rules.
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": "Please provide a valid email address",
    "password": "Password must be at least 8 characters long"
  }
}
```

### General Error Response (`4xx` / `5xx`)
```json
{
  "success": false,
  "message": "Error description"
}
```

> In `development` mode, a `stack` field is also included in `500` error responses.

---

## Common HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | OK — Request successful |
| `201` | Created — Resource created |
| `400` | Bad Request — Invalid input or business logic error |
| `401` | Unauthorized — Missing, invalid, or expired token |
| `403` | Forbidden — Authenticated but insufficient role |
| `404` | Not Found — Resource doesn't exist |
| `422` | Unprocessable Entity — Validation failed (field errors in `errors` object) |
| `429` | Too Many Requests — Rate limit exceeded |
| `500` | Internal Server Error |
