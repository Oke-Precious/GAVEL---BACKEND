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

# 3. Optional: create the first super administrator from .env
npm run create-super-admin

# 4. Start dev server (with auto-reload)
npm run dev

# 5. Run unit tests
npm test
```

### Demo Accounts (after seeding)
All accounts share the password: **`Password123!`**

| Role | Email | Notes |
|---|---|---|
| `super_admin` | superadmin@gavel.app | Platform owner; can create/manage admins and permanently delete eligible users |
| `admin` | admin@gavel.app | Management access except admin creation and user deletion |
| `judge` | judge@gavel.app | Assigned cases scoped automatically |
| `lawyer` | lawyer@gavel.app | Can claim pro-bono cases |
| `clerk` | clerk@gavel.app | Case filing & document uploads |
| `litigant` | litigant@gavel.app | Limited read access |

---

## Environment Configuration

Copy `.env.example` to `.env` and replace every placeholder before starting the backend. Never commit `.env` or expose SMTP/JWT/database secrets.

```env
# Application
PORT=1940
NODE_ENV=development
CLIENT_URL=http://localhost:5173
BACKEND_URL=http://localhost:1940

# Database
MONGO_URI=your_mongodb_atlas_connection_string

# Authentication
JWT_SECRET=replace_with_long_random_string
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace_with_a_different_long_random_string
JWT_REFRESH_EXPIRES_IN=7d

# Brevo SMTP
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USER=your-brevo-smtp-login@smtp-brevo.com
EMAIL_PASS=your-brevo-smtp-key
EMAIL_FROM="GAVEL <your-verified-sender@example.com>"
CONTACT_NOTIFICATION_EMAIL=your-admin-recipient@example.com

# Super-admin bootstrap
SUPER_ADMIN_EMAIL=superadmin@example.com
SUPER_ADMIN_PASSWORD=replace_with_at_least_12_characters
SUPER_ADMIN_FIRST_NAME=System
SUPER_ADMIN_LAST_NAME=Super Admin

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

`CLIENT_URL` controls browser redirects and CORS. `BACKEND_URL` is embedded in verification-email links, so production must use the public HTTPS backend URL rather than `localhost`. Render environment variables must be configured separately from the local `.env` file, followed by a restart or redeploy.

---

## 🔒 Authentication & Authorization

- **JWT Bearer Token**: Send `Authorization: Bearer <accessToken>` in request headers.
- **HTTP-Only Cookie**: A `refreshToken` cookie is set automatically on login. Ensure `withCredentials: true` is configured in your HTTP client (e.g. Axios).
- **Roles**: `super_admin`, `admin`, `judge`, `lawyer`, `clerk`, `litigant`, `public`. Role-restricted routes return `403` if the user's role is not permitted.
- **Super Administrator**: Has access to every role-restricted endpoint. Only a super administrator may create/manage administrators or permanently delete users.
- **Administrator**: Can manage ordinary users but cannot create/promote administrators, delete users, or manage a super-administrator account.
- **Token Expiry**: Access-token lifetime is controlled by `JWT_EXPIRES_IN` and defaults to **15 minutes** (`15m`). Use `POST /auth/refresh-token` to obtain a new pair.

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
| `POST` | `/auth/register` | No | `{ firstName, lastName, email, password, role?, phoneNumber?, barNumber? }` | Registers a volunteer lawyer. The role is always `lawyer`; other roles must use the admin invite flow. |
| `POST` | `/auth/login` | No | `{ email, password }` | Authenticates user and returns `accessToken`, `refreshToken`, and sets `refreshToken` HTTP-only cookie. |
| `POST` | `/auth/logout` | Yes | — | Clears refresh token from DB and cookie. |
| `POST` | `/auth/refresh-token` | No | `{ refreshToken? }` (or via cookie) | Issues a new access + refresh token pair (token rotation). Send either via cookie or JSON body. |
| `GET` | `/auth/me` | Yes | — | Returns the authenticated user's profile. |
| `POST` | `/auth/forgot-password` | No | `{ email }` | Sends a password reset link to the email. Always returns success to prevent enumeration. |
| `POST` | `/auth/reset-password/:token` | No | `{ password }` | Resets the user's password. Token is valid for **10 minutes**. |
| `GET` | `/auth/verify-email/:token` | No | — | Verifies email address. **Browser requests redirect to `CLIENT_URL/login?verified=true`**. API calls (non-HTML `Accept` headers) get JSON. |
| `POST` | `/auth/resend-verification` | No | `{ email }` | Resends verification email. |

### Public Registration Policy

Public self-signup is only available to volunteer lawyers. If `role` is omitted, the account is created with the `lawyer` role. Supplying any other role, including `admin`, `judge`, or `clerk`, returns `403`:

```json
{
  "success": false,
  "message": "Public signup is only available for volunteer lawyers."
}
```

Legal Aid Officers, Records Officers, and other non-lawyer roles must be created with `POST /users/invite`. Only a super administrator may use that endpoint to create an `admin` account. A `super_admin` account can only be created with the secure bootstrap command documented below.

Registration commits the user account before attempting verification email delivery. If delivery fails, the account remains created and the API still returns `201` with the normal `{ success, message, data }` shape:

```json
{
  "success": true,
  "message": "Account created, but verification email could not be sent. Please request a new verification email.",
  "data": {
    "user": { "_id": "...", "email": "lawyer@example.com", "role": "lawyer" }
  }
}
```

The user can then call `POST /auth/resend-verification`. Verification email failures are logged internally and never change a successfully created registration into an error response.

### Verification Email Configuration and Troubleshooting

The project is configured for Brevo SMTP. Copy the exact **SMTP Login** from Brevo's **Settings > SMTP & API > SMTP** page and generate an SMTP key. Do not use a Brevo API key or the Brevo account password.

```env
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USER=your-brevo-smtp-login@smtp-brevo.com
EMAIL_PASS=your-brevo-smtp-key
EMAIL_FROM="GAVEL <your-verified-sender@example.com>"
BACKEND_URL=https://your-backend.example.com
```

Do not set `EMAIL_SERVICE=brevo`; Brevo is selected with `EMAIL_HOST`. `EMAIL_USER` is the Brevo SMTP login and is normally different from the visible sender. `EMAIL_FROM` must be listed as a verified Brevo sender. A verified Gmail address can be used during development, but Brevo may rewrite it and inbox placement may be reduced; use a custom DKIM/DMARC-authenticated domain in production.

If Brevo returns `525 5.7.1 Unauthorized IP address`, either deactivate SMTP IP blocking for development or authorize every calling address under **Settings > Security > Authorized IPs**. A deployed Render service uses its own outbound IP ranges, available from the service's **Connect > Outbound** tab; authorizing only the developer computer will not fix production delivery. A `535` response instead indicates an incorrect SMTP login or SMTP key.

In production, missing or rejected transport configuration is treated as a delivery failure and registration returns the degraded-success message shown above. After changing local environment variables, fully restart the backend. After changing Render variables, restart or redeploy the service.

Useful server logs include `Email submitted to SMTP provider`, accepted/rejected recipient counts, and `Registration verification email failed`. An SMTP `250 OK` response means the provider queued the message, but the recipient provider may still place it in spam or quarantine.

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

Accessible to `admin` and `super_admin` roles.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/analytics/overview` | Total/active/pro-bono case counts + user totals and role distribution. |
| `GET` | `/analytics/heatmap` | Case count grouped by `{ court, stage }`. Excludes `Closed` cases. Useful for court congestion maps. |
| `GET` | `/analytics/trends` | Monthly breakdown of status transitions from `StatusHistory`. Each item: `{ _id: { year, month, status }, count }`. |

---

## 8. User Management (`/users`)

Accessible to `admin` and `super_admin` roles. Super administrators have full access. Regular administrators can manage non-admin users, but cannot delete users, create or promote administrators, or manage super-administrator accounts.

| Method | Endpoint | Access | Request Body / Query | Description |
|---|---|---|---|---|
| `GET` | `/users` | Admin / Super Admin | `?role=lawyer&page=1&limit=20` | Paginated users, filterable by role. Regular admins do not receive super-admin accounts. |
| `POST` | `/users/invite` | Admin / Super Admin | `{ email, firstName, lastName, role, court? }` | Creates a pre-verified account with a temporary password. Only super admins may create an `admin`; `super_admin` cannot be assigned here. |
| `PATCH` | `/users/:id` | Admin / Super Admin | `{ firstName?, lastName?, role?, phoneNumber?, barNumber? }` | Updates supported profile fields. Only a super admin may edit an admin or assign the `admin` role. The `super_admin` role cannot be assigned through the API. |
| `PATCH` | `/users/:id/suspend` | Admin / Super Admin | `{ reason? }` | Suspends a user and invalidates sessions. Only a super admin may suspend an admin; that operation requires a reason of at least 10 characters. Self-suspension is blocked. |
| `PATCH` | `/users/:id/reactivate` | Admin / Super Admin | — | Reactivates a suspended user. Only a super admin may reactivate an admin. |
| `GET` | `/users/:id/audit-log` | Admin / Super Admin | — | Returns suspension/reactivation history, subject to the same management hierarchy. |
| `GET` | `/users/:id/deletion-check` | Super Admin | — | Returns eligibility, dependency counts, and the exact confirmation phrase required before permanent deletion. |
| `DELETE` | `/users/:id` | Super Admin | `{ reason, confirmation }` | Permanently deletes an eligible non-super-admin user. A reason and exact confirmation phrase are mandatory. |

### Create the First Super Administrator

Super administrators cannot be created or promoted through an HTTP endpoint. Configure these environment variables and run the one-time, non-destructive bootstrap command:

```env
SUPER_ADMIN_EMAIL=superadmin@example.com
SUPER_ADMIN_PASSWORD=replace_with_at_least_12_characters
SUPER_ADMIN_FIRST_NAME=System
SUPER_ADMIN_LAST_NAME=Super Admin
```

```bash
npm run create-super-admin
```

The command refuses to overwrite an existing non-super-admin account and reports success without creating a duplicate if the super administrator already exists. The development seed also creates `superadmin@gavel.app` with the shared demo password.

### Permanent User Deletion

Deletion is intentionally a two-step, super-admin-only operation. It cannot delete the current account or any account with the `super_admin` role.

First, fetch the required phrase and dependency check:

```http
GET /users/507f1f77bcf86cd799439011/deletion-check
Authorization: Bearer <superAdminAccessToken>
```

```json
{
  "success": true,
  "message": "User deletion check completed",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "test-lawyer@example.com",
      "role": "lawyer"
    },
    "canDelete": true,
    "requiredConfirmation": "DELETE test-lawyer@example.com",
    "dependencies": {
      "assignedCases": 0,
      "uploadedDocuments": 0,
      "statusChanges": 0,
      "hearings": 0,
      "adjournments": 0,
      "resolvedContacts": 0,
      "administrativeActions": 0,
      "managedUsers": 0
    }
  }
}
```

Then submit the exact, case-sensitive phrase and a meaningful reason of 10–500 characters:

```http
DELETE /users/507f1f77bcf86cd799439011
Authorization: Bearer <superAdminAccessToken>
Content-Type: application/json
```

```json
{
  "reason": "Removing disposable account created during signup testing",
  "confirmation": "DELETE test-lawyer@example.com"
}
```

```json
{
  "success": true,
  "message": "User deleted successfully",
  "data": {
    "deletedUserId": "507f1f77bcf86cd799439011",
    "deletedEmail": "test-lawyer@example.com"
  }
}
```

Deletion returns `409 Conflict` if the user is assigned to cases or owns operational records such as uploads, status changes, hearings, adjournments, resolved contacts, or administrative actions. Reassign those records first. Every deletion attempt that reaches the commit stage creates a separate deletion audit record containing the target snapshot, actor, reason, dependencies, and completion status.

---

## 9. Contact / Report Issue (`/contact`)

### Submit a Contact Message

`POST /contact` is public and does not require authentication.

```json
{
  "name": "Optional sender name",
  "email": "sender@example.com",
  "category": "privacy_concern",
  "message": "Message text"
}
```

Allowed categories are `general_question`, `report_issue`, `privacy_concern`, `case_information_concern`, and `volunteer_legal_aid`. All strings are trimmed. `email`, `category`, and `message` are required, and `message` has a maximum length of 5000 characters.

The message is saved before an email notification is attempted. A notification failure is logged internally and does not fail a successfully saved request.

Success (`201`):

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "messageId": "..."
  }
}
```

### Admin Contact Inbox

These endpoints require a valid `admin` or `super_admin` bearer token.

| Method | Endpoint | Body / Query | Description |
|---|---|---|---|
| `GET` | `/contact/messages` | `?page=1&limit=20&status=new&category=privacy_concern` | Lists messages newest first. `limit` may be 1–100. Filters are optional. |
| `PATCH` | `/contact/messages/:id/status` | `{ status, adminNotes? }` | Updates status and optional notes. Allowed statuses: `new`, `in_review`, `resolved`, `closed`. |

List response:

```json
{
  "success": true,
  "message": "Contact messages retrieved successfully",
  "data": {
    "messages": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "pages": 0
    }
  }
}
```

Status update response:

```json
{
  "success": true,
  "message": "Contact message updated successfully",
  "data": {
    "message": { "_id": "...", "status": "in_review" }
  }
}
```

### Contact Notification Configuration

Set the administrator recipient in the backend environment:

```env
CONTACT_NOTIFICATION_EMAIL=admin@example.com
```

The notification subject is `[GAVEL Contact] <Category Label> from <sender email>` and includes the sender name, email, category, message, created time, and message ID. Existing SMTP variables (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_FROM`) control delivery.

---

## 10. System Health

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
| `409` | Conflict — Resource cannot be deleted while related records exist |
| `422` | Unprocessable Entity — Validation failed (field errors in `errors` object) |
| `429` | Too Many Requests — Rate limit exceeded |
| `500` | Internal Server Error |
