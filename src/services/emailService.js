import { Resend } from "resend";

const supportEmail = process.env.SUPPORT_EMAIL || "info@agritechgh.me";

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  return new Resend(apiKey);
};

const sendEmail = async ({ to, subject, html }) => {
  const resend = getResendClient();

  const { data, error } = await resend.emails.send({
    from: `AgriTech GH <${supportEmail}>`,
    to,
    subject,
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    throw new Error(error.message);
  }

  return data;
};

export const sendVerificationEmail = async (email, fullName, token) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify?token=${token}`;

  const data = await sendEmail({
    to: email,
    subject: "Verify your AgriTech GH account",
    html: `  <h2>Welcome to AgriTech GH, ${fullName}!</h2>
      <p>Please verify your email address by clicking the button below.</p>
     <a href="${verificationUrl}" style="
      background-color: #16a34a;
        color: white;
       padding: 12px 24px;
       text-decoration: none;
      border-radius: 6px;
      display: inline-block;
        margin: 16px 0;
     ">Verify Email</a>
      <p>Or copy this link: ${verificationUrl}</p>
     <p>This link expires in 24 hours.</p>
     <p>If you didn't create this account, ignore this email.</p>`,
  });

  console.log("Email sent:", data);
};

export const sendPasswordResetEmail = async (email, fullName, token) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

  const data = await sendEmail({
    to: email,
    subject: "Reset your AgriTech GH password",
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${fullName},</p>
      <p>You requested to reset your password. Click the button below to reset it.</p>
      <a href="${resetUrl}" style="
        background-color: #16a34a;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 6px;
        display: inline-block;
        margin: 16px 0;
      ">Reset Password</a>
      <p>Or copy this link: ${resetUrl}</p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, ignore this email — your password will not change.</p>
    `,
  });

  console.log("Password reset email sent:", data);
};

export const sendEmailChangeVerification = async (
  newEmail,
  fullName,
  token,
) => {
  const verifyUrl = `${process.env.CLIENT_URL}/verify-email-change?token=${token}&email=${newEmail}`;

  const data = await sendEmail({
    to: newEmail,
    subject: "Verify your new email address",
    html: `
      <h2>Verify your new email</h2>
      <p>Hi ${fullName},</p>
      <p>Click the button below to verify your new email address.</p>
      <a href="${verifyUrl}" style="
        background-color: #16a34a;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 6px;
        display: inline-block;
        margin: 16px 0;
      ">Verify New Email</a>
      <p>Or copy this link: ${verifyUrl}</p>
      <p>This link expires in 24 hours.</p>
      <p>If you did not request this, ignore this email.</p>
    `,
  });

  console.log("Email change verification sent:", data);
};

export const sendKYCStatusEmail = async (
  email,
  fullName,
  status,
  reason = "",
) => {
  const normalizedStatus = String(status || "").toUpperCase();
  const trimmedReason = String(reason || "").trim();
  const isApproved = normalizedStatus === "APPROVED";

  const subject = isApproved
    ? "Your AgriTech GH KYC verification was approved"
    : "Your AgriTech GH KYC verification needs attention";

  const statusHeading = isApproved
    ? "KYC verification approved"
    : "KYC verification was not approved";

  const statusMessage = isApproved
    ? "<p>Your submitted KYC documents have been reviewed and approved. You can continue using your farmer account normally.</p>"
    : "<p>We reviewed your submitted KYC documents and could not approve them yet.</p>";

  const reasonBlock = trimmedReason
    ? `
      <div style="margin: 16px 0; padding: 16px; border-radius: 8px; background-color: #f5f5f4; border-left: 4px solid #16a34a;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #166534;">Admin note</p>
        <p style="margin: 0; color: #1f2937;">${trimmedReason}</p>
      </div>
    `
    : "";

  const nextStep = isApproved
    ? "<p>If you have any questions about your account, reply to this email or contact support.</p>"
    : "<p>Please review the note above, update your documents if needed, and contact support if you need help with your resubmission.</p>";

  const data = await sendEmail({
    to: email,
    subject,
    html: `
      <h2>${statusHeading}</h2>
      <p>Hi ${fullName},</p>
      ${statusMessage}
      ${reasonBlock}
      ${nextStep}
      <p>Support: ${supportEmail}</p>
    `,
  });

  console.log("KYC status email sent:", data);
};
