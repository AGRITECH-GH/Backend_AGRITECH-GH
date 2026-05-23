import rateLimit from "express-rate-limit";

const OAUTH_FLOW_PATHS = new Set([
  "/api/auth/google",
  "/api/auth/google/callback",
  "/api/auth/google/exchange",
]);

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 requests per 15 minutes
  message: { message: "Too many attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => OAUTH_FLOW_PATHS.has(req.path),
});

export const oauthExchangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    message: "Too many Google sign-in attempts, please try again shortly",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // max 10 payment attempts per hour
  message: { message: "Too many payment attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
