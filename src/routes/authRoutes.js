/**
 * @file authRoutes.js
 * @description Authentication routes.
 *
 * Security notes:
 *  - authLimiter          : applied inline on login & register (10 req / 15 min)
 *  - sensitiveAuthLimiter : applied inline on password-reset & email verification
 *    flows (5 req / 15 min) — prevents token brute-force and email flooding
 *  - oauthExchangeLimiter : applied on the Google code-exchange step
 *  - All limiters fire BEFORE the handler, not after (inline placement is key)
 */

import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  deleteAccount,
  editProfile,
  requestEmailChange,
  confirmEmailChange,
  uploadProfilePhoto,
  removeProfilePhoto,
  googleAuth,
  googleCallbackMiddleware,
  googleCallbackHandler,
  exchangeGoogleCode,
  getRoleSetupStatus,
  completeRoleSetup,
  resubmitKYC,
  getMe,
} from "../controllers/authController.js";
import {
  uploadProfilePhoto as uploadPhotoMiddleware,
  uploadKYCDocuments,
} from "../middleware/upload.js";
import {
  authLimiter,
  sensitiveAuthLimiter,
  oauthExchangeLimiter,
  authenticatedWriteLimiter,
} from "../middleware/rateLimiter.js";
import { validate, schemas } from "../middleware/validate.js";

const router = Router();

// ---------------------------------------------------------------------------
// Auth — login & registration (10 req / 15 min per IP)
// ---------------------------------------------------------------------------
router.post("/register", authLimiter, uploadKYCDocuments, validate(schemas.register, { allowExtra: true }), register);
router.post("/login",    authLimiter, validate(schemas.login), login);

// ---------------------------------------------------------------------------
// Token management
// authLimiter on /refresh prevents token-cycling / flooding attacks.
// /logout is covered by the global generalLimiter (100/15 min).
// ---------------------------------------------------------------------------
router.post("/refresh", authLimiter, refresh);
router.post("/logout",  logout);

// ---------------------------------------------------------------------------
// Email verification (5 req / 15 min per IP — prevents token brute-force)
// ---------------------------------------------------------------------------
router.post("/verify-email",          sensitiveAuthLimiter, validate(schemas.verifyEmail),          verifyEmail);
router.post("/resend-verification",   sensitiveAuthLimiter, validate(schemas.resendVerification),   resendVerification);

// ---------------------------------------------------------------------------
// Password reset (5 req / 15 min per IP — prevents email flooding & brute-force)
// ---------------------------------------------------------------------------
router.post("/forgot-password", sensitiveAuthLimiter, validate(schemas.forgotPassword), forgotPassword);
router.post("/reset-password",  sensitiveAuthLimiter, validate(schemas.resetPassword),  resetPassword);

// ---------------------------------------------------------------------------
// Authenticated profile management
// sensitiveAuthLimiter (5/15 min) on password/email-change to prevent abuse.
// authenticatedWriteLimiter on other profile mutations (keyed userId+IP).
// ---------------------------------------------------------------------------
router.put("/change-password",        authenticate, sensitiveAuthLimiter, validate(schemas.changePassword), changePassword);
router.delete("/delete-account",      authenticate, sensitiveAuthLimiter, deleteAccount);
router.put("/edit-profile",           authenticate, authenticatedWriteLimiter, validate(schemas.editProfile, { allowExtra: false }), editProfile);
router.post("/request-email-change",  authenticate, sensitiveAuthLimiter, validate(schemas.requestEmailChange), requestEmailChange);
router.post("/confirm-email-change",  sensitiveAuthLimiter, validate(schemas.confirmEmailChange), confirmEmailChange);

// ---------------------------------------------------------------------------
// Profile photo
// ---------------------------------------------------------------------------
router.post("/profile-photo",   authenticate, authenticatedWriteLimiter, uploadPhotoMiddleware, uploadProfilePhoto);
router.delete("/profile-photo", authenticate, authenticatedWriteLimiter, removeProfilePhoto);

// ---------------------------------------------------------------------------
// Google OAuth — redirect flow (no JSON body; limiters are on the exchange step)
// ---------------------------------------------------------------------------
router.get("/google",          googleAuth);
router.get("/google/callback", googleCallbackMiddleware, googleCallbackHandler);
router.post(
  "/google/exchange",
  oauthExchangeLimiter,
  validate(schemas.exchangeGoogleCode),
  exchangeGoogleCode
);

// ---------------------------------------------------------------------------
// Role setup
// authenticatedWriteLimiter on complete-role-setup to prevent rapid re-uploads.
// sensitiveAuthLimiter on resubmit-kyc — it involves file processing and email.
// ---------------------------------------------------------------------------
router.get("/role-setup-status",    authenticate, getRoleSetupStatus);
router.post(
  "/complete-role-setup",
  authenticate,
  authenticatedWriteLimiter,
  uploadKYCDocuments,
  completeRoleSetup
);

router.post(
  "/resubmit-kyc",
  authenticate,
  sensitiveAuthLimiter,
  uploadKYCDocuments,
  resubmitKYC
);

router.get("/me", authenticate, getMe);

console.log("Auth routes loaded");
router.stack.forEach((r) => {
  if (r.route) console.log(r.route.path);
});

export default router;
