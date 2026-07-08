/**
 * @file rateLimiter.js
 * @description Centralised rate-limiting middleware.
 *
 * OWASP A04 – Insecure Design / A07 – Identification & Authentication Failures:
 * All public and authenticated endpoints are rate-limited to prevent brute-force
 * attacks, credential stuffing, email flooding, and DoS.
 *
 * Key design decisions:
 * - IP-based limiting for unauthenticated routes (standard)
 * - Dual IP + user-ID key for authenticated routes — prevents one abusive
 *   account from cycling IPs to bypass limits
 * - Separate, tighter limits for sensitive auth actions (password reset, etc.)
 * - Graceful 429 responses: always JSON, includes Retry-After header via
 *   `standardHeaders: true`
 * - OAuth flow paths (Google redirect chain) are exempted from the general
 *   limiter because the redirect loop triggers multiple requests in quick
 *   succession that would otherwise hit the limit
 */

import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Key generator for authenticated routes.
 * Uses `userId:IP` when the user is authenticated so that a single abusive
 * user cannot bypass the limit by rotating IP addresses.
 * Falls back to IP-only for unauthenticated requests.
 *
 * Uses ipKeyGenerator() for the IP component so that IPv6 addresses are
 * handled correctly (express-rate-limit v8 requirement).
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
const authenticatedKey = (req) => {
  const userId = req.user?.id;
  const ip = ipKeyGenerator(req);
  return userId ? `${userId}:${ip}` : ip;
};

/**
 * Standard 429 JSON handler.
 * Returns a structured error so clients can parse `retryAfter` programmatically.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {Function}                   _next
 * @param {object}                     options  - rateLimit options
 */
const handle429 = (req, res, _next, options) => {
  res.status(429).json({
    message: options.message?.message ?? "Too many requests, please try again later",
    retryAfter: Math.ceil(options.windowMs / 1000), // seconds
  });
};

// ---------------------------------------------------------------------------
// OAuth paths — exempt from generalLimiter to prevent false-positives during
// the multi-redirect Google OAuth dance.
// ---------------------------------------------------------------------------
const OAUTH_FLOW_PATHS = new Set([
  "/api/auth/google",
  "/api/auth/google/callback",
]);

// ---------------------------------------------------------------------------
// Limiters
// ---------------------------------------------------------------------------

/**
 * General limiter — applied globally to all API routes.
 * 100 requests per 15 minutes per IP.
 * OAuth redirect paths are skipped (see OAUTH_FLOW_PATHS).
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,  // sets RateLimit-* headers (RFC 6585)
  legacyHeaders: false,
  handler: handle429,
  skip: (req) => OAUTH_FLOW_PATHS.has(req.path),
});

/**
 * Auth limiter — login and register endpoints.
 * 10 requests per 15 minutes per IP.
 * Prevents credential stuffing and registration flooding.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: "Too many attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  handler: handle429,
});

/**
 * Sensitive auth limiter — forgot-password, reset-password,
 * resend-verification, verify-email endpoints.
 * Tighter: 5 requests per 15 minutes per IP.
 * Prevents token brute-force and email flooding.
 */
export const sensitiveAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    message: "Too many attempts on a sensitive action, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: handle429,
});

/**
 * Payment limiter — payment initialisation endpoint.
 * 10 requests per hour per IP.
 * Prevents abuse of payment gateway (Paystack charges per attempt).
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { message: "Too many payment attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  handler: handle429,
});

/**
 * Public read limiter — unauthenticated GET endpoints (listings, user profiles).
 * 60 requests per minute per IP.
 * Prevents scraping and lightweight DoS on expensive DB queries.
 */
export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { message: "Too many requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  handler: handle429,
});

/**
 * OAuth exchange limiter — the code-exchange step after Google callback.
 * 30 requests per 15 minutes per IP.
 * One-time-use codes; 30 is generous for normal usage but blocks scanners.
 */
export const oauthExchangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: {
    message: "Too many Google sign-in attempts, please try again shortly",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: handle429,
});

/**
 * Webhook limiter — server-to-server webhook endpoints (Pusher).
 * These are mounted BEFORE the global limiter (they need the raw body parser
 * to run before express.json), so they need their own ceiling.
 * 120 requests per minute per IP — generous for legitimate webhook bursts,
 * blocks brute-force attempts against the HMAC signature.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: { message: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
  handler: handle429,
});

/**
 * Authenticated action limiter — write operations on authenticated routes.
 * 60 requests per 15 minutes, keyed on userId + IP.
 * Applied to mutating endpoints (orders, messages, reviews, etc.).
 */
export const authenticatedWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  keyGenerator: authenticatedKey,
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  handler: handle429,
});
