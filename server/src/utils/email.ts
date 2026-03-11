import nodemailer from "nodemailer";

// ── Transport factory ─────────────────────────────────────────────────────────
// If SMTP_HOST / SMTP_USER / SMTP_PASS env vars are present we use a real
// transport; otherwise we fall back to logging the email to the console so
// local development still works without any mail server.

const hasSmtp =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

const transport = hasSmtp
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true", // true for 465
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    })
  : null;

const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "OpenNotes <no-reply@opennotes.in>";

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send a transactional email.
 * In development (no SMTP env vars) the email is printed to the console instead.
 */
export async function sendMail(opts: MailOptions): Promise<void> {
  if (transport) {
    await transport.sendMail({
      from: FROM_ADDRESS,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
    });
  } else {
    // ── DEV FALLBACK ───────────────────────────────────────────────────────
    console.log("\n━━━━━━━━━━━━━━━━  📧  EMAIL (dev mode)  ━━━━━━━━━━━━━━━━");
    console.log(`TO:      ${opts.to}`);
    console.log(`SUBJECT: ${opts.subject}`);
    console.log("BODY:");
    // strip tags for readability
    console.log(opts.html.replace(/<[^>]+>/g, "").replace(/\s{2,}/g, " ").trim());
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }
}

// ── Template helpers ──────────────────────────────────────────────────────────

export function passwordResetEmail(
  name: string,
  resetUrl: string,
  expiresMinutes = 30,
): MailOptions {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:#003366;padding:28px 32px;text-align:center;">
              <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
                OpenNotes <span style="color:#FFC000;">●</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 28px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;">
                Reset your password
              </h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
                Hi ${name.split(" ")[0]}, we received a request to reset the password
                for your OpenNotes account. Click the button below to choose a new password.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}"
                       style="display:inline-block;background:#003366;color:#ffffff;font-weight:800;
                              font-size:14px;text-decoration:none;border-radius:10px;
                              padding:14px 32px;letter-spacing:0.3px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">
                This link expires in <strong>${expiresMinutes} minutes</strong> and can only be used once.
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- URL fallback -->
          <tr>
            <td style="padding:0 32px 28px;">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;">
                <p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">
                  Or copy this link
                </p>
                <p style="margin:0;font-size:11px;color:#475569;word-break:break-all;">${resetUrl}</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 28px;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0;font-size:11px;color:#cbd5e1;">
                OpenNotes · BITS Pilani Notes Exchange Platform
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    to: "", // filled by caller
    subject: "Reset your OpenNotes password",
    html,
  };
}
