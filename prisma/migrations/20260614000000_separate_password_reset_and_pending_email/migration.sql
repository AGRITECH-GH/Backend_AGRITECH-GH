-- Add dedicated columns for the password-reset flow so it no longer
-- shares verificationToken with the email-verification flow (security fix).
-- Add pendingEmail so the email-change flow binds the token to the intended
-- address server-side, preventing token-hijack account takeover (security fix).

ALTER TABLE "User" ADD COLUMN "passwordResetToken"       TEXT UNIQUE;
ALTER TABLE "User" ADD COLUMN "passwordResetTokenExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "pendingEmail"             VARCHAR(150);
