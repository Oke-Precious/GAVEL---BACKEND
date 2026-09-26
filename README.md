# GAVEL Backend

GAVEL Backend is the Express/MongoDB API for the GAVEL case management and volunteer legal aid platform. It provides authentication, role-based access control, case workflows, document uploads, analytics, contact/report issue handling, and administrative user management.

All API responses follow the frontend contract:

```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```

Errors use:

```json
{
  "success": false,
  "message": "Error message"
}
```

## API Base URLs

Local:

```text
http://localhost:1940/api/v1
```

Production:

```text
https://your-backend-domain.example.com/api/v1
```

Interactive documentation is served from:

```text
http://localhost:1940/docs
```

Full endpoint documentation is also available in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

## Tech Stack

- Node.js
- Express 5
- MongoDB with Mongoose
- JWT authentication
- Brevo Transactional Email API / SMTP fallback
- EJS documentation page
- Node test runner

## Getting Started

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
copy .env.example .env
```

Update `.env` with real values for MongoDB, JWT secrets, frontend/backend URLs, and email settings.

Start the development server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

If PowerShell blocks `npm.ps1`, use:

```bash
npm.cmd test
```

## Available Scripts

```bash
npm start
```

Starts the production server with `node server.js`.

```bash
npm run dev
```

Starts the development server with Node watch mode.

```bash
npm run seed
```

Seeds demo users and sample data.

```bash
npm run create-super-admin
```

Creates the first super administrator from the `SUPER_ADMIN_*` environment variables.

```bash
npm test
```

Runs the backend test suite.

## Environment Variables

Important variables:

```env
PORT=1940
NODE_ENV=development
CLIENT_URL=http://localhost:5173
BACKEND_URL=http://localhost:1940
EMAIL_VERIFICATION_URL_BASE=http://localhost:1940/api/v1/auth/verify-email

MONGO_URI=your_mongodb_atlas_connection_string

JWT_SECRET=replace_with_long_random_string
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace_with_a_different_long_random_string
JWT_REFRESH_EXPIRES_IN=7d

BREVO_API_KEY=your-brevo-api-key
EMAIL_FROM="GAVEL <your-verified-sender@example.com>"

CONTACT_NOTIFICATION_EMAIL=your-admin-recipient@example.com

SUPER_ADMIN_EMAIL=superadmin@example.com
SUPER_ADMIN_PASSWORD=replace_with_at_least_12_characters
SUPER_ADMIN_FIRST_NAME=System
SUPER_ADMIN_LAST_NAME=Super Admin
```

See [.env.example](./.env.example) for the complete template.

## Email Delivery Notes

For Render hosting, prefer Brevo Transactional Email API:

```env
BREVO_API_KEY=your-brevo-api-key
```

Render free web services block common SMTP ports `25`, `465`, and `587`. The backend therefore uses Brevo API first when `BREVO_API_KEY` is configured. SMTP remains available as a fallback:

```env
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=2525
EMAIL_USER=your-brevo-smtp-login@smtp-brevo.com
EMAIL_PASS=your-brevo-smtp-key
EMAIL_FROM="GAVEL <your-verified-sender@example.com>"
```

`EMAIL_FROM` must be a verified Brevo sender.

The verification email button uses `EMAIL_VERIFICATION_URL_BASE`. The backend appends the token automatically. Keep it pointed at the backend endpoint unless the frontend has a route that can verify the token or redirect to the backend verification endpoint.

## Authentication and Roles

Public signup is only for volunteer lawyers:

```json
{
  "role": "lawyer"
}
```

Public registration rejects `admin`, `judge`, `clerk`, and other non-lawyer roles. Those users must be created through the admin invite flow.

Supported roles include:

- `super_admin`
- `admin`
- `judge`
- `lawyer`
- `clerk`
- `litigant`
- `public`

`super_admin` has full management access, including creating admins and deleting eligible users. `admin` can manage ordinary users but cannot create admins or delete accounts.

## Core Modules

- Auth: registration, login, refresh token, logout, password reset, email verification
- User management: invite, edit, suspend, reactivate, delete with super-admin confirmation
- Cases: filing, assignment, status workflow, analytics
- Documents: upload and serve case documents
- Contact inbox: public contact/report issue endpoint and admin inbox
- Public endpoints: scorecards, trends, backlog map, public case verification
- Docs: `/docs` and `API_DOCUMENTATION.md`

## Useful Test Requests

Signup:

```http
POST /api/v1/auth/register
Content-Type: application/json
```

```json
{
  "firstName": "Test",
  "lastName": "Lawyer",
  "email": "testlawyer@example.com",
  "password": "UseAStrongTestPassword123!",
  "role": "lawyer",
  "barNumber": "SCN/TEST/001"
}
```

Health check:

```http
GET /api/v1/health
```

## Deployment Checklist

Before deploying:

- Set production `NODE_ENV=production`.
- Set `MONGO_URI` to the production MongoDB connection string.
- Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET`.
- Set `BACKEND_URL` to the public backend URL.
- Set `CLIENT_URL` to the deployed frontend URL.
- Set `BREVO_API_KEY` for reliable email delivery on Render.
- Set `EMAIL_FROM` to a verified Brevo sender.
- Redeploy after changing environment variables.

## Project Notes

- The local `.env` file is ignored and should never be committed.
- `.env.example` is only a template.
- The `postman` folder, if present, is only for manual API testing and is not required at runtime.
- Uploaded files are served from `/uploads`.
