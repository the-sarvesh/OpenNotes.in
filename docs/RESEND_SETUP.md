# Resend setup for OpenNotes

The application can detect and report email delivery failures, but Resend must reactivate the account before production OTPs can be delivered.

## Account review

Use `https://opennotes.in/` for both the company website and the page where recipients register. Select **Transactional** and **Notifications**. Explain that OpenNotes sends account verification codes, password-reset codes, and order-lifecycle updates only to users who directly create an account or participate in an order. State that no purchased lists are used and users can report delivery problems through the public Report Issue page.

## Transactional email coverage

OpenNotes sends branded emails to the buyer and seller for meaningful order activity: order placement, seller acknowledgement, completed exchange, cancellation, meetup proposal changes, and the 30-minute meetup reminder. Routine chat messages, typing indicators, and online-status changes do not send email.

Order emails are placed in a durable database queue, retried with backoff, and deduplicated by business event. A temporary Resend outage does not roll back or falsely fail a successful order action.

## Production configuration

1. Verify `opennotes.in` in Resend and complete all SPF/DKIM records.
2. Create a production API key and set `RESEND_API_KEY` on the backend only.
3. Set `EMAIL_FROM` to a verified sender, for example `OpenNotes <no-reply@opennotes.in>`.
4. Add a Resend webhook pointing to:

   `https://api.opennotes.in/api/webhooks/resend`

5. Subscribe to sent, delivered, delayed, bounced, complained, and suppressed email events.
6. Copy the signing secret into `RESEND_WEBHOOK_SECRET` on the backend.
7. Redeploy the backend. Startup automatically creates the `order_email_jobs` queue table.
8. Perform a registration test and an order-lifecycle test with buyer and seller accounts on real allowed email domains.

Never place the API key or webhook signing secret in the client, Git repository, screenshots, or issue reports.
