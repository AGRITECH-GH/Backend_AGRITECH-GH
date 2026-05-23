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
} from "../controllers/authController.js";
import {
  uploadProfilePhoto as uploadPhotoMiddleware,
  uploadKYCDocuments,
} from "../middleware/upload.js";

const router = Router();

router.post("/register", uploadKYCDocuments, register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.put("/change-password", authenticate, changePassword);
router.delete("/delete-account", authenticate, deleteAccount);
router.put("/edit-profile", authenticate, editProfile);
router.post("/request-email-change", authenticate, requestEmailChange);
router.post("/confirm-email-change", confirmEmailChange);
router.post(
  "/profile-photo",
  authenticate,
  uploadPhotoMiddleware,
  uploadProfilePhoto,
);
router.delete("/profile-photo", authenticate, removeProfilePhoto);
router.get("/google", googleAuth);
router.get("/google/callback", googleCallbackMiddleware, googleCallbackHandler);
router.post("/google/exchange", exchangeGoogleCode);
router.get("/role-setup-status", authenticate, getRoleSetupStatus);
router.post(
  "/complete-role-setup",
  authenticate,
  uploadKYCDocuments,
  completeRoleSetup,
);
console.log("Auth routes loaded");
router.stack.forEach((r) => {
  if (r.route) console.log(r.route.path);
});

export default router;
