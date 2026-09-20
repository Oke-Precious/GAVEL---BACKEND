# GAVEL Postman Test Guide

Import these two files into Postman:

- `GAVEL_API.postman_collection.json`
- `Local.postman_environment.json`

Select the **GAVEL Local** environment before sending requests.

## 1. Prepare the backend

Set a deliverable SMTP identity in `.env`. `EMAIL_FROM` should be verified by the SMTP provider and should normally use the same mailbox/domain as `EMAIL_USER`.

For a fresh disposable database, `npm run seed` creates the demo admin and super-admin accounts. **The seed command clears existing seeded collections, so do not run it against data you need.**

For an existing database, configure the `SUPER_ADMIN_*` variables and run the non-destructive command:

```bash
npm run create-super-admin
npm run dev
```

## 2. Configure Postman variables

Before registration testing, replace `signupEmail` with a real inbox that you can open. Use a new address or delete the old disposable account through the super-admin workflow first.

If you did not use the development seed, replace `superAdminEmail`, `superAdminPassword`, `adminEmail`, and `adminPassword` with your actual test credentials.

Use unique values for `deleteTargetEmail` and `newAdminEmail` each time you run only part of the collection. A complete successful run deletes both generated accounts, allowing those addresses to be reused.

## 3. Run requests in folder order

1. **System** confirms the server and documentation page are reachable.
2. **Authentication and email** registers a lawyer, rejects public admin signup, resends verification, and logs in both management roles.
3. Open the verification email. Copy only the token from the URL into `verificationToken`, then run **Verify email using token**.
4. **Contact and issue reporting** tests public persistence plus the admin inbox.
5. **Ordinary-user lifecycle** proves an admin can invite/edit/suspend/reactivate but cannot delete, then uses the super admin to preflight and delete the disposable user.
6. **Administrator lifecycle** proves an admin cannot create or suspend another admin, then uses the super admin to create, suspend, reactivate, preflight, and delete the test administrator.
7. **Signup-account cleanup** deletes the account created during email testing so `signupEmail` can be reused on the next run.

## Email troubleshooting

- A `201` registration response with “verification email could not be sent” means account creation succeeded but SMTP submission failed.
- A normal registration response means the SMTP provider accepted the message; it can still be filtered into spam/quarantine afterward.
- Check the backend log for `Email submitted to SMTP provider`, accepted/rejected counts, or `Registration verification email failed`.
- Confirm the deployed environment contains `EMAIL_HOST` or `EMAIL_SERVICE`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, and `BACKEND_URL`.
- Restart/redeploy after changing provider environment variables.
- Ensure `EMAIL_FROM` is a verified sender and does not impersonate an unrelated domain.
