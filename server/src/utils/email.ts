const RESEND_API_KEY = process.env.SMTP_PASS || process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "OpenNotes <no-reply@opennotes.in>";

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: any[];
}

/**
 * Send a transactional email via Resend HTTP API.
 * This bypasses SMTP port blocking (587/465) on cloud providers like Render.
 */
export async function sendMail(opts: MailOptions): Promise<void> {
  // If no API key, log to console (dev mode)
  if (!RESEND_API_KEY || process.env.NODE_ENV === "development") {
    console.log("\n━━━━━━━━━━━━━━━━  📧  EMAIL (dev/mock mode)  ━━━━━━━━━━━━━━━━");
    console.log(`TO:      ${opts.to}`);
    console.log(`SUBJECT: ${opts.subject}`);
    console.log("BODY (excerpt):");
    console.log(opts.html.replace(/<[^>]+>/g, "").substring(0, 200) + "...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return;
  }

  try {
    console.log(`[Email] Sending to ${opts.to} via Resend HTTP API...`);
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status} from Resend`);
    }

    console.log(`[Email] Success! Message ID: ${data.id}`);
  } catch (err: any) {
    console.error(`[Email Error] Failed to send via Resend API: ${err.message}`);
    // We throw so the caller knows it failed if they await it
    throw err;
  }
}

// ── Template helpers ──────────────────────────────────────────────────────────

export function passwordResetEmail(
  to: string,
  name: string,
  resetUrl: string,
  otp: string,
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
                Hi ${name.split(" ")[0]}, enter the 6-digit code below in the app to choose a new password. It expires in ${expiresMinutes} minutes.
              </p>

              <!-- OTP Box -->
              <div style="background:#f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 32px; font-weight: 800; letter-spacing: 12px; color: #003366; font-family: monospace;">${otp}</span>
              </div>

              <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">
                If you are on the same device, you can also use this direct link:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}"
                       style="display:inline-block;background:#003366;color:#ffffff;font-weight:800;
                              font-size:14px;text-decoration:none;border-radius:10px;
                              padding:12px 24px;letter-spacing:0.3px;">
                      Reset Password Link
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:11px;color:#94a3b8;">
                If you didn't request a password reset, you can safely ignore this email.
              </p>
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
    to,
    subject: `Password Reset: ${otp} is your code`,
    html,
  };
}

export function verificationEmail(
  to: string,
  name: string,
  verifyUrl: string,
  otp: string,
): MailOptions {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your OpenNotes account</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding: 40px 16px; }
    .main { max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04); overflow: hidden; border: 1px solid #eef2f6; }
    .header { background-color: #0f172a; padding: 32px; text-align: center; }
    .logo { color: #facc15; font-size: 28px; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
    .logo span { color: #ffffff; }
    .content { padding: 40px 32px; text-align: left; }
    .greeting { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 16px; }
    .text { font-size: 15px; line-height: 1.7; color: #475569; margin: 0 0 24px; }
    .otp-box { background-color: #f8fafc; border: 2px solid #facc15; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 32px; }
    .otp-code { font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #0f172a; font-family: monospace; }
    .btn-container { text-align: center; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #facc15; color: #000000 !important; padding: 14px 32px; border-radius: 14px; font-size: 14px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 15px rgba(250, 204, 21, 0.2); }
    .footer { background-color: #fcfdfe; padding: 32px; border-top: 1px solid #f1f5f9; text-align: center; }
    .footer-text { font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main">
      <div class="header">
        <h1 class="logo">Open<span>Notes.in</span></h1>
      </div>
      
      <div class="content">
        <p class="greeting">Hey ${name.split(' ')[0]}! 👋</p>
        <p class="text">
          Enter this 6-digit code in the app to activate your account.
        </p>

        <div class="otp-box">
          <span class="otp-code">${otp}</span>
        </div>

        <p class="text" style="font-size: 13px; margin-bottom: 12px; color: #94a3b8;">
          Or click this direct link if you're on the same device:
        </p>
        <div class="btn-container">
          <a href="${verifyUrl}" class="btn">Verify Account Link</a>
        </div>
      </div>

      <div class="footer">
        <p class="footer-text">
          <strong>OpenNotes.in</strong><br>
          Bitsian Notes Exchange Platform
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return {
    to,
    subject: `Verify Account: ${otp} is your code`,
    html,
  };
}
