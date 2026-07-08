/**
 * @file app.js
 * @description Express application bootstrap.
 *
 * Security measures applied here (in order):
 *  1. validateEnv()   — crash-fast if any required secret is missing (A05)
 *  2. helmet()        — sets secure HTTP response headers (A05)
 *  3. cors()          — strict allow-list of origins (A01)
 *  4. express.json()  — 50 KB body size cap to prevent payload-flood DoS (A04)
 *  5. generalLimiter  — 100 req/15 min global IP-based ceiling (A04)
 *  6. Route-specific limiters are applied INLINE on their routers (see
 *     authRoutes.js, paymentRoutes.js) so the limits fire before any handler
 *     logic — not after the routers are already mounted.
 */

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

// Startup env guard — must run before anything else
import { validateEnv } from "./config/env.js";
validateEnv();

import authRouter from "./routes/authRoutes.js";
import { authenticate } from "./middleware/authenticate.js";
import listingRouter from "./routes/listingRoutes.js";
import orderRouter from "./routes/orderRoutes.js";
import cartRouter from "./routes/cartRoutes.js";
import barterRouter from "./routes/barterRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import agentRouter from "./routes/agentRoutes.js";
import paymentRouter from "./routes/paymentRoutes.js";
import {
  generalLimiter,
  publicReadLimiter,
  webhookLimiter,
} from "./middleware/rateLimiter.js";
import categoryRouter from "./routes/categoryRoutes.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import negotiationRouter from "./routes/negotiationRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import reviewRouter from "./routes/reviewRoutes.js";
import disputeRouter from "./routes/disputeRoutes.js";
import pusherRouter from "./routes/pusherRoutes.js";
import passport from "./config/passport.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
global.__dirname = __dirname;

const app = express();

// ---------------------------------------------------------------------------
// Trust the first proxy hop only (Render, Railway, Vercel, Nginx, etc.)
// Required for express-rate-limit to read the real client IP from X-Forwarded-For.
// Change to the number of proxy hops in your infrastructure if needed.
// ---------------------------------------------------------------------------
app.set("trust proxy", 1);

// ---------------------------------------------------------------------------
// 1. Secure HTTP response headers (OWASP A05 – Security Misconfiguration)
//    helmet sets: X-Frame-Options, X-Content-Type-Options, HSTS,
//    X-XSS-Protection, Referrer-Policy, and more.
// ---------------------------------------------------------------------------
app.use(helmet());

// ---------------------------------------------------------------------------
// 2. CORS — strict origin allow-list
// ---------------------------------------------------------------------------
const allowedOrigins = [
  "https://www.farmbridgeafrica.com",
  "https://farmbridgeafrica.com",
  "http://localhost:5173",
];

const normalizeOrigin = (origin) => String(origin || "").replace(/\/$/, "");

// Allow additional origins from CLIENT_URL env var (supports comma-separated list)
if (process.env.CLIENT_URL) {
  if (process.env.CLIENT_URL.includes(",")) {
    process.env.CLIENT_URL.split(",").forEach((url) => {
      const sanitized = normalizeOrigin(url.trim());
      if (sanitized && !allowedOrigins.includes(sanitized)) {
        allowedOrigins.push(sanitized);
      }
    });
    // Keep CLIENT_URL as the primary redirect target
    process.env.CLIENT_URL = process.env.CLIENT_URL.split(",")[0].trim();
  } else {
    const sanitized = normalizeOrigin(process.env.CLIENT_URL);
    if (sanitized && !allowedOrigins.includes(sanitized)) {
      allowedOrigins.push(sanitized);
    }
  }
}

// Only log allowed origins in development — avoid leaking infra info in prod logs
if (process.env.NODE_ENV !== "production") {
  console.log("Configured CORS Allowed Origins:", allowedOrigins);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, Postman, mobile apps)
    if (!origin) return callback(null, true);
    const normalized = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalized)) return callback(null, true);
    console.error(`CORS blocked for origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// ---------------------------------------------------------------------------
// 3. Body parsing
//    Webhook route MUST receive the raw body for HMAC signature verification.
//    All other routes get JSON parsing capped at 50 KB to prevent DoS via
//    huge payloads (OWASP A04 – Insecure Design).
// ---------------------------------------------------------------------------
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
// Pusher webhook must be mounted before express.json (raw body for HMAC),
// which also places it before generalLimiter — so it gets its own limiter.
app.use("/api/pusher", webhookLimiter, pusherRouter);
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(cookieParser());
app.use(passport.initialize());

// ---------------------------------------------------------------------------
// 4. Request logger — development only
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// ---------------------------------------------------------------------------
// 5. Global rate limiter — MUST be applied before routers so it fires on
//    every request. Route-specific limiters (authLimiter, paymentLimiter, etc.)
//    are applied INLINE inside each router file for correct ordering.
// ---------------------------------------------------------------------------
app.use(generalLimiter);

// ---------------------------------------------------------------------------
// 6. Health check — intentionally before auth middleware, after rate limiter
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// 7. Routers
//    - Auth, payment limiters are applied INLINE in their router files.
//    - Public read endpoints get the publicReadLimiter here.
// ---------------------------------------------------------------------------
app.use("/api/auth", authRouter);

// Public listing & user routes — apply read limiter to prevent scraping / DoS
app.use("/api/listings", publicReadLimiter, listingRouter);
app.use("/api/users", publicReadLimiter, userRouter);

app.use("/api/orders", orderRouter);
app.use("/api/cart", cartRouter);
app.use("/api/barter", barterRouter);
app.use("/api/admin", adminRouter);
app.use("/api/agents", agentRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/conversations", messageRouter);
app.use("/api/negotiations", negotiationRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/disputes", disputeRouter);

// Protected smoke-test route
app.get("/api/protected", authenticate, (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// 8. Global error handler
//    Catches multer file-too-large errors and other unhandled errors cleanly
//    without leaking stack traces to the client.
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // Multer file size exceeded
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File is too large" });
  }
  // JSON body too large
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large" });
  }
  // Invalid JSON
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ message: "Internal server error" });
});

export default app;
