import { createTransport } from "nodemailer";

export async function sendOtpEmail({ to, name, otp, purpose }) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    if (process.env.ALLOW_DEV_OTP === "true") {
      console.log(`[DEV OTP] ${purpose} for ${to}: ${otp}`);
      return;
    }
    throw new Error("Gmail SMTP credentials are not configured.");
  }

  const transporter = createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: process.env.GMAIL_FROM || user,
    to,
    subject: "Your Dayflow verification code",
    text: `Hello ${name || "there"},\n\nYour Dayflow verification code is ${otp}.\n\nPurpose: ${purpose}.\nThis code expires in 10 minutes.`,
  });
}
