const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

async function test() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  console.log("Testing SMTP connection with:", {
    host,
    port,
    user,
    secure,
  });

  if (!host || !user || !pass) {
    console.error("❌ Missing SMTP env vars!");
    return;
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });

  try {
    console.log("Verifying connection...");
    await transport.verify();
    console.log("✅ SMTP connection verified!");
    
    console.log("Sending test email with attachment...");
    await transport.sendMail({
      from: process.env.EMAIL_FROM || "no-reply@opennotes.in",
      to: "sarveshsoni45092@gmail.com",
      subject: "Test Email with Attachment from OpenNotes",
      text: "If you receive this, SMTP and attachments are working correctly.",
      attachments: [
        {
          filename: "logo.png",
          path: path.join(__dirname, "../client/public/logo512.png"),
          cid: "emailBanner",
        },
      ],
    });
    console.log("✅ Test email with attachment sent!");
  } catch (err) {
    console.error("❌ SMTP Error:", err);
    if (err.code === 'ETIMEDOUT') {
      console.error("The connection timed out. This usually means the port is blocked by a firewall or the host is unreachable.");
    }
  }
}

test();
