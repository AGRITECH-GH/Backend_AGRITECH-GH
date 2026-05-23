/**
 * @file env.js
 * @description Startup environment variable validation guard.
 *
 * OWASP A05 – Security Misconfiguration: Validates that every required secret
 * is present before the server accepts any traffic. A missing secret that
 * silently resolves to `undefined` can cause subtle auth-bypass bugs (e.g.
 * `jwt.sign(payload, undefined)` succeeds with the string "undefined" as the
 * key). We fail-fast instead.
 *
 * Call `validateEnv()` as the very first thing in app.js / server.js.
 */

/**
 * Required environment variable definitions.
 * Each entry specifies:
 *  - `key`       : the process.env key name
 *  - `minLength` : minimum character length (catches obvious placeholder values)
 */
const REQUIRED_ENV_VARS = [
  { key: "DATABASE_URL",           minLength: 10 },
  { key: "JWT_ACCESS_SECRET",      minLength: 16 },
  { key: "JWT_REFRESH_SECRET",     minLength: 16 },
  { key: "JWT_GOOGLE_CODE_SECRET", minLength: 16 },
  { key: "CLIENT_URL",             minLength: 5  },
  { key: "CLOUDINARY_CLOUD_NAME",  minLength: 1  },
  { key: "CLOUDINARY_API_KEY",     minLength: 1  },
  { key: "CLOUDINARY_API_SECRET",  minLength: 1  },
  { key: "RESEND_API_KEY",         minLength: 5  },
  { key: "PAYSTACK_SECRET_KEY",    minLength: 10 },
  { key: "GOOGLE_CLIENT_ID",       minLength: 10 },
  { key: "GOOGLE_CLIENT_SECRET",   minLength: 5  },
  { key: "GOOGLE_CALLBACK_URL",    minLength: 5  },
];

/**
 * Validates all required environment variables.
 * Throws a descriptive error (and exits the process) if any are missing
 * or obviously unset.
 *
 * @throws {Error} if any required variable is missing or too short
 */
export function validateEnv() {
  const missing = [];

  for (const { key, minLength } of REQUIRED_ENV_VARS) {
    const value = process.env[key];
    if (!value || value.trim().length < minLength) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const list = missing.map((k) => `  - ${k}`).join("\n");
    console.error(
      `\n[FATAL] Missing or invalid environment variables:\n${list}\n` +
      `\nSet them in your .env file and restart the server.\n`
    );
    process.exit(1);
  }

  // Only log env check success in non-production to avoid noisy prod logs
  if (process.env.NODE_ENV !== "production") {
    console.log("[env] All required environment variables are present.");
  }
}
