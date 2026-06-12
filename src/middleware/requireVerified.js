export const requireVerified = (req, res, next) => {
  if (process.env.DISABLE_EMAIL_VERIFICATION === "true") {
    return next();
  }

  if (!req.user || !req.user.isVerified) {
    return res.status(403).json({
      message: "Please verify your email to perform this action",
      isVerified: false,
    });
  }
  next();
};
