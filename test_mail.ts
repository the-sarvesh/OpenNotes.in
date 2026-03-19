import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), "server/.env") });

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000,
});

async function test() {
  console.log("Testing SMTP connection with:", {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    secure: process.env.SMTP_SECURE,
  });

  try {
    await transport.verify();
    console.log("✅ SMTP connection verified!");
    
    await transport.sendMail({
      from: process.env.EMAIL_FROM || "test@opennotes.in",
      to: "sarveshsoni45092@gmail.com",
      subject: "Test Email from OpenNotes",
      text: "If you receive this, SMTP is working correctly.",
    });
    console.log("✅ Test email sent!");
  } catch (err) {
    console.error("❌ SMTP Error:", err);
  }
}

test();
