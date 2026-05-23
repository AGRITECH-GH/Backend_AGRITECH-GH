/**
 * @file validate.js
 * @description Schema-based request validation middleware.
 *
 * OWASP A03 – Injection / A04 – Insecure Design:
 * Provides centralised, schema-driven input validation and sanitisation for
 * request bodies and query parameters. Avoids mass-assignment by only
 * permitting explicitly declared fields through to the controller.
 *
 * Usage:
 *   import { validate, schemas } from '../middleware/validate.js';
 *   router.post('/login', validate(schemas.login), loginHandler);
 *
 * Schema field options:
 *   - required   {boolean}          Field must be present and non-empty
 *   - type       {string}           'string' | 'number' | 'boolean' | 'email'
 *   - minLength  {number}           Minimum string length
 *   - maxLength  {number}           Maximum string length
 *   - min        {number}           Minimum numeric value
 *   - max        {number}           Maximum numeric value
 *   - enum       {Array}            Value must be one of these (case-insensitive for strings)
 *   - pattern    {RegExp}           Value must match this regex
 *   - trim       {boolean}          Auto-trim string values (default: true)
 *   - optional   {boolean}          Field is optional; skip validation if absent
 */

// ---------------------------------------------------------------------------
// Email regex — RFC 5321-ish; intentionally simple and fast.
// ---------------------------------------------------------------------------
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

/**
 * Validates a single field value against its schema rule.
 *
 * @param {string} field      - Field name (for error messages)
 * @param {*}      value      - The raw value from the request
 * @param {object} rule       - Schema rule object (see file header)
 * @returns {string|null}     - Error message string, or null if valid
 */
function validateField(field, value, rule) {
  const isAbsent = value === undefined || value === null || value === "";

  // Optional fields: skip all validation if not provided
  if (rule.optional && isAbsent) return null;

  // Required check
  if (rule.required && isAbsent) {
    return `${field} is required`;
  }

  // If not required and absent, nothing more to check
  if (isAbsent) return null;

  // Auto-trim strings before further validation
  const coerced =
    rule.type === "string" || rule.type === "email"
      ? String(value).trim()
      : value;

  // Type checks
  if (rule.type === "email") {
    if (!EMAIL_REGEX.test(String(coerced))) {
      return `${field} must be a valid email address`;
    }
  }

  if (rule.type === "string" && typeof coerced !== "string") {
    return `${field} must be a string`;
  }

  if (rule.type === "number") {
    const n = Number(value);
    if (Number.isNaN(n)) return `${field} must be a number`;
    if (rule.min !== undefined && n < rule.min)
      return `${field} must be at least ${rule.min}`;
    if (rule.max !== undefined && n > rule.max)
      return `${field} must be at most ${rule.max}`;
  }

  if (rule.type === "boolean") {
    if (typeof value !== "boolean" && value !== "true" && value !== "false") {
      return `${field} must be a boolean`;
    }
  }

  // String length checks
  if (
    (rule.type === "string" || rule.type === "email") &&
    typeof coerced === "string"
  ) {
    if (rule.minLength !== undefined && coerced.length < rule.minLength)
      return `${field} must be at least ${rule.minLength} characters`;
    if (rule.maxLength !== undefined && coerced.length > rule.maxLength)
      return `${field} must be at most ${rule.maxLength} characters`;
  }

  // Enum check (case-insensitive for strings)
  if (rule.enum) {
    const normalized =
      typeof coerced === "string" ? coerced.toUpperCase() : coerced;
    const normalizedEnum = rule.enum.map((e) =>
      typeof e === "string" ? e.toUpperCase() : e
    );
    if (!normalizedEnum.includes(normalized)) {
      return `${field} must be one of: ${rule.enum.join(", ")}`;
    }
  }

  // Pattern check
  if (rule.pattern && !rule.pattern.test(String(coerced))) {
    return `${field} has an invalid format`;
  }

  return null;
}

/**
 * Express middleware factory. Validates `req.body` against the given schema.
 * Rejects unexpected fields (anti mass-assignment).
 * Returns 400 with per-field error details on failure.
 *
 * @param {object} schema   - Map of fieldName → rule object
 * @param {object} [opts]   - Options
 * @param {boolean} [opts.allowExtra=false] - Allow fields not in schema (default: reject them)
 * @param {string}  [opts.source='body']    - Where to read from: 'body' | 'query'
 * @returns {Function} Express middleware
 */
export function validate(schema, opts = {}) {
  const { allowExtra = false, source = "body" } = opts;

  return (req, res, next) => {
    const data = source === "query" ? req.query : req.body;
    const errors = [];

    // Validate declared fields
    for (const [field, rule] of Object.entries(schema)) {
      const error = validateField(field, data?.[field], rule);
      if (error) errors.push(error);
    }

    // Reject unexpected fields (anti mass-assignment)
    if (!allowExtra && source === "body" && data && typeof data === "object") {
      const allowedKeys = new Set(Object.keys(schema));
      const unexpected = Object.keys(data).filter((k) => !allowedKeys.has(k));
      if (unexpected.length > 0) {
        errors.push(`Unexpected fields: ${unexpected.join(", ")}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors,
      });
    }

    // Sanitise: trim string fields in-place so controllers get clean data
    if (source === "body" && data && typeof data === "object") {
      for (const [field, rule] of Object.entries(schema)) {
        if (
          (rule.type === "string" || rule.type === "email") &&
          typeof data[field] === "string"
        ) {
          // Lowercase emails for consistent DB lookups
          data[field] =
            rule.type === "email"
              ? data[field].trim().toLowerCase()
              : data[field].trim();
        }
      }
    }

    return next();
  };
}

// ---------------------------------------------------------------------------
// Reusable schemas
// ---------------------------------------------------------------------------

export const schemas = {
  /**
   * POST /api/auth/register
   */
  register: {
    fullName: {
      required: true,
      type: "string",
      minLength: 2,
      maxLength: 100,
    },
    email: {
      required: true,
      type: "email",
    },
    password: {
      required: true,
      type: "string",
      minLength: 8,
      maxLength: 128,
    },
    role: {
      required: true,
      type: "string",
      enum: ["BUYER", "FARMER", "AGENT"],
    },
    // FARMER / AGENT optional fields — further validated in controller
    nationalIdNumber:          { optional: true, type: "string", maxLength: 50 },
    farmRegistrationNumber:    { optional: true, type: "string", maxLength: 50 },
    businessCertificateNumber: { optional: true, type: "string", maxLength: 50 },
    assignedRegion:            { optional: true, type: "string", maxLength: 100 },
    commissionRate:            { optional: true },
    bio:                       { optional: true, type: "string", maxLength: 1000 },
  },

  /**
   * POST /api/auth/login
   */
  login: {
    email:      { required: true, type: "email" },
    password:   { required: true, type: "string", minLength: 1, maxLength: 128 },
    rememberMe: { optional: true },
  },

  /**
   * POST /api/auth/forgot-password
   */
  forgotPassword: {
    email: { required: true, type: "email" },
  },

  /**
   * POST /api/auth/reset-password
   */
  resetPassword: {
    token:    { required: true, type: "string", minLength: 1, maxLength: 256 },
    password: { required: true, type: "string", minLength: 8, maxLength: 128 },
  },

  /**
   * POST /api/auth/verify-email
   */
  verifyEmail: {
    token: { required: true, type: "string", minLength: 1, maxLength: 256 },
  },

  /**
   * POST /api/auth/resend-verification
   */
  resendVerification: {
    email: { required: true, type: "email" },
  },

  /**
   * PUT /api/auth/edit-profile
   */
  editProfile: {
    fullName:    { optional: true, type: "string", minLength: 2, maxLength: 100 },
    phoneNumber: {
      optional: true,
      type: "string",
      maxLength: 20,
      // E.164-ish: allows optional leading +, then digits, spaces, dashes, parens
      pattern: /^[+]?[\d\s\-().]{7,20}$/,
    },
    region: { optional: true, type: "string", maxLength: 100 },
    bio:    { optional: true, type: "string", maxLength: 1000 },
  },

  /**
   * POST /api/auth/request-email-change
   */
  requestEmailChange: {
    newEmail: { required: true, type: "email" },
    password: { required: true, type: "string", minLength: 1, maxLength: 128 },
  },

  /**
   * POST /api/auth/confirm-email-change
   */
  confirmEmailChange: {
    token:    { required: true, type: "string", minLength: 1, maxLength: 256 },
    newEmail: { required: true, type: "email" },
  },

  /**
   * POST /api/orders
   */
  createOrder: {
    paymentMethod:   {
      required: true,
      type: "string",
      // Values match Checkout.jsx PAYMENT_METHODS — PAYSTACK included for
      // server-side payment flows (e.g. Paystack redirect callback)
      enum: ["CASH", "MOMO", "CREDIT", "BARTER", "PAYSTACK"],
    },
    deliveryAddress: { optional: true, type: "string", maxLength: 300 },
    notes:           { optional: true, type: "string", maxLength: 500 },
  },

  /**
   * POST /api/conversations/:id/messages
   */
  sendMessage: {
    content: {
      required: true,
      type: "string",
      minLength: 1,
      maxLength: 2000,
    },
  },

  /**
   * POST /api/reviews
   */
  createReview: {
    orderId: { required: true, type: "string", maxLength: 100 },
    rating:  { required: true },
    type:    {
      optional: true,
      type: "string",
      enum: ["BUYER", "SELLER", "AGENT"],
    },
    comment: { optional: true, type: "string", maxLength: 1000 },
  },

  /**
   * POST /api/conversations
   */
  createConversation: {
    otherUserId: { required: true, type: "string", maxLength: 100 },
    listingId:   { optional: true, type: "string", maxLength: 100 },
  },

  /**
   * POST /api/auth/google/exchange
   */
  exchangeGoogleCode: {
    code: { required: true, type: "string", minLength: 1, maxLength: 1024 },
  },
};
