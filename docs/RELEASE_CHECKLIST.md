# OpenNotes release checklist

Use this checklist for every production update.

## Before merging

1. Run `npm ci` from the repository root.
2. Run `npm run check`. Do not release unless lint, tests, client build, and server build all pass.
3. Deploy the branch to a preview environment and use a separate test database.
4. Verify these flows in the preview:
   - register, receive OTP, verify, and sign in;
   - resend an OTP and confirm the one-minute cooldown;
   - create a listing with one and multiple subjects;
   - browse/filter Semester 7 and Software Engineering;
   - place an order, refresh/retry once, and confirm only one order exists;
   - submit an issue with and without a screenshot;
   - open the admin issue inbox and delivery diagnostics.

## Production configuration

- `JWT_SECRET` must be a long random value.
- `DB_URL` and `DB_AUTH_TOKEN` must point to the production database.
- `FRONTEND_URL`, `BACKEND_URL`, and Google OAuth callback must use the live domains.
- `RESEND_API_KEY`, `EMAIL_FROM`, and `RESEND_WEBHOOK_SECRET` must be configured.
- Cloudinary credentials must all be present for durable uploads.
- `ALLOWED_PREVIEW_ORIGINS` must contain only exact trusted HTTPS preview URLs, never a wildcard.

## After deployment

1. Confirm `/api/health` returns HTTP 200 with `status: ok`.
2. Run one real-domain OTP delivery test and confirm its Resend status becomes delivered.
3. Check the admin dashboard for open issues, email failures, and failed notification jobs.
4. Watch server error logs and request IDs during the first 15 minutes.
5. If a critical flow fails, roll back to the previous successful deployment before investigating.

## Database safety

- Take a provider backup/export before destructive admin or migration work.
- Test restore instructions at least once per quarter.
- Never use the admin purge action as a cleanup tool; it permanently removes marketplace data.
