import { createTransport } from "nodemailer";

function mailer() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    if (process.env.ALLOW_DEV_OTP === "true") {
      return null;
    }
    throw new Error("Gmail SMTP credentials are not configured.");
  }

  return createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

function fromAddress() {
  return process.env.GMAIL_FROM || process.env.GMAIL_USER;
}

function purposeLine(purpose) {
  if (purpose === "employee-login") return "employee login verification";
  if (purpose === "signup") return "account signup verification";
  if (purpose === "password-reset") return "password reset verification";
  return "verification";
}

export async function sendOtpEmail({ to, name, otp, purpose }) {
  const subject =
    purpose === "password-reset"
      ? "Reset your Dayflow password"
      : purpose === "employee-login"
        ? "Verify your Dayflow employee login"
        : "Verify your Dayflow account";
  const text = `Hello ${name || "there"},

Your Dayflow OTP is ${otp}.

Use this code for ${purposeLine(purpose)}. It expires in 10 minutes.

If you did not request this, you can ignore this email.`;

  const transporter = mailer();
  if (!transporter) {
    console.log(`[DEV OTP] ${purpose} for ${to}: ${otp}`);
    return;
  }
  await transporter.sendMail({ from: fromAddress(), to, subject, text });
}

export async function sendEmployeeInviteEmail({ to, name, employeeId, temporaryPassword, loginUrl }) {
  const text = `Hello ${name},

Your Dayflow employee account has been created by HR.

Login link: ${loginUrl}
Employee ID: ${employeeId}
Temporary password: ${temporaryPassword}

Sign in with these credentials. For security, Dayflow will verify your email with an OTP and then ask you to set a new password before you continue.

Welcome aboard.`;

  const transporter = mailer();
  if (!transporter) {
    console.log(`[DEV INVITE] ${to}: ${employeeId} / ${temporaryPassword} / ${loginUrl}`);
    return;
  }
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Your Dayflow employee login is ready",
    text,
  });
}
