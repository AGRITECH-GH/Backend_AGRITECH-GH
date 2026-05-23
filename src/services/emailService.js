import { Resend } from "resend";

const supportEmail = process.env.SUPPORT_EMAIL || "info@farmbridgeafrica.com";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const EMAIL_VARIANTS = {
  transactional: {
    pageBg: "#eef7f0",
    shellBg:
      "radial-gradient(circle at 12% 15%, rgba(34,197,94,0.24), transparent 38%),radial-gradient(circle at 88% 88%, rgba(16,185,129,0.2), transparent 42%),linear-gradient(160deg,#f7fff8 0%,#f2fbf4 55%,#eaf8ef 100%)",
    shellBorder: "#d7efdc",
    shellShadow: "0 8px 26px rgba(22,101,52,0.08)",
    brandColor: "#166534",
    headingColor: "#052e16",
    innerBg: "rgba(255,255,255,0.74)",
    innerBorder: "rgba(187,247,208,0.8)",
    linkColor: "#166534",
    buttonBg: "linear-gradient(135deg,#16a34a 0%,#059669 100%)",
  },
  marketplace: {
    pageBg: "#eef2ff",
    shellBg:
      "radial-gradient(circle at 15% 15%, rgba(56,189,248,0.24), transparent 36%),radial-gradient(circle at 90% 80%, rgba(129,140,248,0.24), transparent 42%),linear-gradient(160deg,#f7faff 0%,#f0f5ff 55%,#e9f0ff 100%)",
    shellBorder: "#dbe4ff",
    shellShadow: "0 8px 26px rgba(30,64,175,0.12)",
    brandColor: "#1d4ed8",
    headingColor: "#172554",
    innerBg: "rgba(255,255,255,0.78)",
    innerBorder: "rgba(191,219,254,0.85)",
    linkColor: "#1d4ed8",
    buttonBg: "linear-gradient(135deg,#2563eb 0%,#4f46e5 100%)",
  },
};

const getEmailTheme = (variant) =>
  EMAIL_VARIANTS[variant] || EMAIL_VARIANTS.transactional;

const renderButton = (label, url, buttonBg) => `
  <a href="${url}" style="
    display:inline-block;
    padding:12px 22px;
    background:${buttonBg};
    color:#ffffff;
    text-decoration:none;
    border-radius:9999px;
    font-weight:700;
    font-size:14px;
    letter-spacing:0.1px;
  ">${escapeHtml(label)}</a>
`;

const renderEmailTemplate = ({
  preheader,
  heading,
  recipientName,
  bodyHtml,
  variant = "transactional",
  actionLabel,
  actionUrl,
  supportLine,
}) => {
  const theme = getEmailTheme(variant);
  const safeHeading = escapeHtml(heading);
  const safeRecipient = escapeHtml(recipientName || "there");
  const actionBlock =
    actionLabel && actionUrl
      ? `
      <div style="margin:22px 0 16px;">
        ${renderButton(actionLabel, actionUrl, theme.buttonBg)}
      </div>
      <p style="margin:0 0 10px;color:#4b5563;font-size:13px;line-height:1.5;">
        If the button does not work, use this link:<br />
        <a href="${actionUrl}" style="color:${theme.linkColor};word-break:break-all;">${escapeHtml(actionUrl)}</a>
      </p>
    `
      : "";

  const supportBlock = supportLine
    ? `<p style="margin:14px 0 0;color:#4b5563;font-size:13px;line-height:1.5;">${supportLine}</p>`
    : "";

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${safeHeading}</title>
      </head>
      <body style="margin:0;padding:0;background:${theme.pageBg};font-family:Arial,sans-serif;color:#111827;">
        <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">
          ${escapeHtml(preheader || heading)}
        </span>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${theme.pageBg};padding:22px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border-collapse:separate;">
                <tr>
                  <td style="
                    border-radius:18px;
                    overflow:hidden;
                    background:${theme.shellBg};
                    border:1px solid ${theme.shellBorder};
                    box-shadow:${theme.shellShadow};
                  ">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:24px 24px 10px;">
                          <p style="margin:0;color:${theme.brandColor};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
                            FarmBridge Africa
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 24px 24px;background:${theme.innerBg};border-top:1px solid ${theme.innerBorder};">
                          <h2 style="margin:22px 0 10px;font-size:26px;line-height:1.2;color:${theme.headingColor};">${safeHeading}</h2>
                          <p style="margin:0 0 16px;color:#1f2937;font-size:15px;line-height:1.6;">Hi ${safeRecipient},</p>
                          <div style="color:#1f2937;font-size:15px;line-height:1.65;">
                            ${bodyHtml}
                          </div>
                          ${actionBlock}
                          ${supportBlock}
                          <p style="margin:18px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
                            You are receiving this email because of activity on your FarmBridge account.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

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
    from: `FarmBridge Africa <${supportEmail}>`,
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
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;

  const data = await sendEmail({
    to: email,
    subject: "Verify your FarmBridge Africa account",
    html: renderEmailTemplate({
      preheader: "Verify your FarmBridge Africa account",
      heading: `Welcome to FarmBridge Africa, ${fullName}!`,
      recipientName: fullName,
      bodyHtml: `
        <p style="margin:0 0 10px;">Please verify your email address to activate your account.</p>
        <p style="margin:0;">This link expires in 24 hours. If you did not create this account, you can ignore this message.</p>
      `,
      actionLabel: "Verify Email",
      actionUrl: verificationUrl,
      variant: "transactional",
      supportLine: `Support: <a href="mailto:${supportEmail}" style="color:#166534;">${escapeHtml(supportEmail)}</a>`,
    }),
  });

  console.log("Email sent:", data);
};

export const sendPasswordResetEmail = async (email, fullName, token) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

  const data = await sendEmail({
    to: email,
    subject: "Reset your FarmBridge Africa password",
    html: renderEmailTemplate({
      preheader: "Reset your FarmBridge password",
      heading: "Password Reset Request",
      recipientName: fullName,
      bodyHtml: `
        <p style="margin:0 0 10px;">We received a request to reset your password.</p>
        <p style="margin:0 0 10px;">Use the button below to choose a new password.</p>
        <p style="margin:0;">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      `,
      actionLabel: "Reset Password",
      actionUrl: resetUrl,
      variant: "transactional",
      supportLine: `Support: <a href="mailto:${supportEmail}" style="color:#166534;">${escapeHtml(supportEmail)}</a>`,
    }),
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
    html: renderEmailTemplate({
      preheader: "Confirm your new email address",
      heading: "Verify Your New Email",
      recipientName: fullName,
      bodyHtml: `
        <p style="margin:0 0 10px;">Click the button below to verify your new email address.</p>
        <p style="margin:0;">This link expires in 24 hours. If you did not request this, you can ignore this email.</p>
      `,
      actionLabel: "Verify New Email",
      actionUrl: verifyUrl,
      variant: "transactional",
      supportLine: `Support: <a href="mailto:${supportEmail}" style="color:#166534;">${escapeHtml(supportEmail)}</a>`,
    }),
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
    ? "Your FarmBridge Africa KYC verification was approved"
    : "Your FarmBridge Africa KYC verification needs attention";

  const statusHeading = isApproved
    ? "KYC verification approved"
    : "KYC verification was not approved";

  const statusMessage = isApproved
    ? "<p>Your submitted KYC documents have been reviewed and approved. You can continue using your farmer account normally.</p>"
    : "<p>We reviewed your submitted KYC documents and could not approve them yet.</p>";

  const reasonBlock = trimmedReason
    ? `
      <div style="margin: 16px 0; padding: 16px; border-radius: 12px; background-color: #f2f6f2; border-left: 4px solid #16a34a;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #166534;">Admin note</p>
        <p style="margin: 0; color: #1f2937;">${escapeHtml(trimmedReason)}</p>
      </div>
    `
    : "";

  const nextStep = isApproved
    ? "<p>If you have any questions about your account, reply to this email or contact support.</p>"
    : "<p>Please review the note above, update your documents if needed, and contact support if you need help with your resubmission.</p>";

  const data = await sendEmail({
    to: email,
    subject,
    html: renderEmailTemplate({
      preheader: subject,
      heading: statusHeading,
      recipientName: fullName,
      bodyHtml: `
        ${statusMessage}
        ${reasonBlock}
        ${nextStep}
      `,
      actionLabel: "Open FarmBridge",
      actionUrl: `${process.env.CLIENT_URL}/profile`,
      variant: "transactional",
      supportLine: `Support: <a href="mailto:${supportEmail}" style="color:#166534;">${escapeHtml(supportEmail)}</a>`,
    }),
  });

  console.log("KYC status email sent:", data);
};

export const sendNewMessageEmail = async ({
  email,
  recipientName,
  senderName,
  listingTitle,
  conversationId,
}) => {
  const inboxUrl = `${process.env.CLIENT_URL}/messages/${conversationId}`;
  const context = listingTitle
    ? ` about <strong>${escapeHtml(listingTitle)}</strong>`
    : "";

  await sendEmail({
    to: email,
    subject: `New message from ${senderName}`,
    html: renderEmailTemplate({
      preheader: "You have a new message on FarmBridge",
      heading: "You Have a New Message",
      recipientName,
      bodyHtml: `
        <p style="margin:0;">
          <strong>${escapeHtml(senderName)}</strong> sent you a message${context}.
        </p>
      `,
      actionLabel: "View Message",
      actionUrl: inboxUrl,
      variant: "marketplace",
      supportLine: `Support: <a href="mailto:${supportEmail}" style="color:#166534;">${escapeHtml(supportEmail)}</a>`,
    }),
  });
};

const NEGOTIATION_STATUS_LABELS = {
  PENDING: "New offer received",
  ACCEPTED: "Your offer was accepted 🎉",
  REJECTED: "Your offer was declined",
  COUNTERED: "A counter-offer was made",
  WITHDRAWN: "An offer was withdrawn",
};

export const sendNegotiationUpdateEmail = async ({
  email,
  recipientName,
  senderName,
  listingTitle,
  status,
  offeredPrice,
  note,
}) => {
  const offersUrl = `${process.env.CLIENT_URL}/marketplace`;
  const heading = NEGOTIATION_STATUS_LABELS[status] ?? "Offer update";
  const noteBlock = note
    ? `<blockquote style="border-left:4px solid #16a34a;padding:8px 16px;margin:16px 0;color:#374151;">${escapeHtml(note)}</blockquote>`
    : "";

  await sendEmail({
    to: email,
    subject: `${heading} — ${listingTitle}`,
    html: renderEmailTemplate({
      preheader: heading,
      heading,
      recipientName,
      bodyHtml: `
        <p style="margin:0;">
          <strong>${escapeHtml(senderName)}</strong>
          ${status === "PENDING" ? "made an offer of" : "responded to your offer on"}
          <strong>${escapeHtml(listingTitle)}</strong>
          ${status === "PENDING" ? ` at <strong>GHS ${Number(offeredPrice).toFixed(2)}</strong>` : ""}.
        </p>
        ${noteBlock}
      `,
      actionLabel: "View on FarmBridge",
      actionUrl: offersUrl,
      variant: "marketplace",
      supportLine: `Support: <a href="mailto:${supportEmail}" style="color:#166534;">${escapeHtml(supportEmail)}</a>`,
    }),
  });
};
