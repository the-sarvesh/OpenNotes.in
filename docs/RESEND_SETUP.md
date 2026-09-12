# Resend setup for OpenNotes

The application can detect and report email delivery failures, but Resend must reactivate the account before production OTPs can be delivered.

## Account review

Use `https://opennotes.in/` for both the company website and the page where recipients register. Select **Transactional** and **Notifications**. Explain that OpenNotes sends account verification codes, password-reset codes, and order reminders only to users who directly create an account or place an order. State that no purchased lists are used and users can report delivery problems through the public Report Issue page.

## Production configuration

1. Verify `opennotes.in` in Resend and complete all SPF/DKIM records.
2. Create a production API key and set `RESEND_API_KEY` on the backend only.
3. Set `EMAIL_FROM` to a verified sender, for example `OpenNotes <no-reply@opennotes.in>`.
4. Add a Resend webhook pointing to:

   `https://api.opennotes.in/api/webhooks/resend`

5. Subscribe to sent, delivered, delayed, bounced, complained, and suppressed email events.
6. Copy the signing secret into `RESEND_WEBHOOK_SECRET` on the backend.
7. Redeploy the backend and perform a registration test with a real allowed email domain.

Never place the API key or webhook signing secret in the client, Git repository, screenshots, or issue reports.
