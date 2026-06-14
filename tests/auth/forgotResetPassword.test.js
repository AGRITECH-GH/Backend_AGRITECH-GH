import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- mock passport (avoids GOOGLE_CLIENT_ID requirement at import time) ----------
vi.mock("../../src/config/passport.js", () => ({ default: { initialize: vi.fn(() => (_r, _s, n) => n()), authenticate: vi.fn() } }));

// ---------- mock prisma ----------
const prismaMock = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock("../../src/config/prisma.js", () => ({ default: prismaMock }));

// ---------- mock email service ----------
const emailMock = { sendPasswordResetEmail: vi.fn() };
vi.mock("../../src/services/emailService.js", () => emailMock);

// ---------- mock crypto (deterministic token) ----------
vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual,
      randomBytes: vi.fn(() => ({ toString: () => "reset-token-abc123" })),
    },
  };
});

const { forgotPassword, resetPassword } = await import(
  "../../src/controllers/authController.js"
);

// ---------- helpers ----------
const makeReq = (body = {}) => ({ body });
const makeRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => vi.clearAllMocks());

// ===========================================================================
// forgotPassword — token isolation
// ===========================================================================
describe("forgotPassword", () => {
  it("writes the reset token to passwordResetToken, NOT to verificationToken", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      fullName: "Alice",
    });
    prismaMock.user.update.mockResolvedValue({});
    emailMock.sendPasswordResetEmail.mockResolvedValue();

    const req = makeReq({ email: "alice@example.com" });
    const res = makeRes();
    await forgotPassword(req, res);

    expect(prismaMock.user.update).toHaveBeenCalledOnce();
    const updateCall = prismaMock.user.update.mock.calls[0][0];

    // Must use dedicated reset-token fields
    expect(updateCall.data).toHaveProperty("passwordResetToken");
    expect(updateCall.data).toHaveProperty("passwordResetTokenExpiry");

    // Must NOT touch the email-verification field
    expect(updateCall.data).not.toHaveProperty("verificationToken");
    expect(updateCall.data).not.toHaveProperty("verificationTokenExpiry");
  });

  it("returns 200 even when the email does not exist (enumeration guard)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const req = makeReq({ email: "nobody@example.com" });
    const res = makeRes();
    await forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// resetPassword — reads from passwordResetToken
// ===========================================================================
describe("resetPassword", () => {
  it("looks up user by passwordResetToken, not verificationToken", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      passwordHash: "old-hash",
    });
    prismaMock.user.update.mockResolvedValue({});

    const req = makeReq({ token: "reset-token-abc123", password: "NewPass1" });
    const res = makeRes();
    await resetPassword(req, res);

    expect(prismaMock.user.findFirst).toHaveBeenCalledOnce();
    const findCall = prismaMock.user.findFirst.mock.calls[0][0];

    // Must query the dedicated reset-token field
    expect(findCall.where).toHaveProperty("passwordResetToken");

    // Must NOT query verificationToken
    expect(findCall.where).not.toHaveProperty("verificationToken");
  });

  it("clears passwordResetToken and passwordResetTokenExpiry after a successful reset", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      passwordHash: "old-hash",
    });
    prismaMock.user.update.mockResolvedValue({});

    const req = makeReq({ token: "reset-token-abc123", password: "NewPass1" });
    const res = makeRes();
    await resetPassword(req, res);

    const updateCall = prismaMock.user.update.mock.calls[0][0];
    expect(updateCall.data.passwordResetToken).toBeNull();
    expect(updateCall.data.passwordResetTokenExpiry).toBeNull();
    expect(updateCall.data).not.toHaveProperty("verificationToken");
  });

  it("returns 400 for an invalid or expired token", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const req = makeReq({ token: "expired-token", password: "NewPass1" });
    const res = makeRes();
    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
