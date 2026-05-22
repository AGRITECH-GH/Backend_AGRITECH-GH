import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/authRoutes.js";
import { authenticate } from "./middleware/authenticate.js";
import listingRouter from "./routes/listingRoutes.js";
import orderRouter from "./routes/orderRoutes.js";
import cartRouter from "./routes/cartRoutes.js";
import barterRouter from "./routes/barterRoutes.js";
import adminRouter from "./routes/adminRouter.js"; // Note: verify if this should be adminRoutes.js based on your imports, keeping as is
import agentRouter from "./routes/agentRoutes.js";
import paymentRouter from "./routes/paymentRoutes.js";
import {
  authLimiter,
  generalLimiter,
  paymentLimiter,
} from "./middleware/rateLimiter.js";
import categoryRouter from "./routes/categoryRoutes.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import negotiationRouter from "./routes/negotiationRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import reviewRouter from "./routes/reviewRoutes.js";
import disputeRouter from "./routes/disputeRoutes.js";
import passport from "./config/passport.js";

const app = express();

// 1. Define allowed origins (including both www and non-www versions of your domain)
const allowedOrigins = [
  "https://www.farmbridgeafrica.com",
  "https://farmbridgeafrica.com",
  "http://localhost:5173",
];

// 2. Sanitize and inject CLIENT_URL environment variable if it exists
if (process.env.CLIENT_URL) {
  const sanitizedClientUrl = process.env.CLIENT_URL.replace(/\/$/, ""); // Removes any trailing slash
  if (!allowedOrigins.includes(sanitizedClientUrl)) {
    allowedOrigins.push(sanitizedClientUrl);
  }
}

// 3. Configure CORS middleware with dynamic dynamic origin matching
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, postman, or server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`CORS Blocked for origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  }),
);

// 4. Explicitly catch and respond to preflight OPTIONS requests across all paths
app.options("*", cors());

console.log("Configured CORS Allowed Origins:", allowedOrigins);

// Webhook parsing must come BEFORE express.json()
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(generalLimiter);
app.use("/api/auth", authRouter);
app.use("/api/listings", listingRouter);
app.use("/api/orders", orderRouter);
app.use("/api/cart", cartRouter);
app.use("/api/barter", barterRouter);
app.use("/api/admin", adminRouter);
app.use("/api/agents", agentRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/payments/initialize", paymentLimiter);
app.use("/api/categories", categoryRouter);
app.use("/api/users", userRouter);
app.use("/api/conversations", messageRouter);
app.use("/api/negotiations", negotiationRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/disputes", disputeRouter);
app.get("/api/protected", authenticate, (req, res) => {});

export default app;
