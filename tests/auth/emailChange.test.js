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
vi.mock("../../src/services/emailService.js", () => ({
  sendEmailChangeVerification: vi.fn(),
}));

// ---------- mock bcrypt ----------
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn().mockResolvedValue(true) },
}));

// ---------- mock crypto ----------
vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual,
      randomBytes: vi.fn(() => ({ toString: () => "change-token-xyz" })),
    },
  };
});

const { requestEmailChange, confirmEmailChange } = await import(
  "../../src/controllers/authController.js"
);

const makeRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => vi.clearAllMocks());

// ===========================================================================
// requestEmailChange — stores pendingEmail in the DB
// ===========================================================================
describe("requestEmailChange", () => {
  it("persists pendingEmail to the database alongside the token", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        email: "old@example.com",
        fullName: "Alice",
        passwordHash: "hash",
      })
      .mockResolvedValueOnce(null); // email not taken

    prismaMock.user.update.mockResolvedValue({});

    const req = {
      user: { id: "user-1" },
      body: { newEmail: "new@example.com", password: "Password1" },
    };
    const res = makeRes();
    await requestEmailChange(req, res);

    expect(prismaMock.user.update).toHaveBeenCalledOnce();
    const updateData = prismaMock.user.update.mock.calls[0][0].data;

    // The new email MUST be stored server-side so confirmEmailChange can use it
    expect(updateData).toHaveProperty("pendingEmail", "new@example.com");
    expect(updateData).toHaveProperty("verificationToken");
  });
});

// ===========================================================================
// confirmEmailChange — uses server-stored pendingEmail, ignores body newEmail
// ===========================================================================
describe("confirmEmailChange", () => {
  it("uses the server-stored pendingEmail, not the newEmail from the request body", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      email: "old@example.com",
      pendingEmail: "new@example.com", // stored server-side
      fullName: "Alice",
    });
    prismaMock.user.findUnique.mockResolvedValue(null); // new email not taken
    prismaMock.user.update.mockResolvedValue({});

    const req = {
      body: {
        token: "change-token-xyz",
        newEmail: "attacker@evil.com", // attacker tries to hijack
      },
    };
    const res = makeRes();
    await confirmEmailChange(req, res);

    expect(prismaMock.user.update).toHaveBeenCalledOnce();
    const updateData = prismaMock.user.update.mock.calls[0][0].data;

    // Must use the server-stored email, NOT the attacker-supplied one
    expect(updateData.email).toBe("new@example.com");
    expect(updateData.email).not.toBe("attacker@evil.com");
  });

  it("clears pendingEmail after the change is applied", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      email: "old@example.com",
      pendingEmail: "new@example.com",
      fullName: "Alice",
    });
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.update.mockResolvedValue({});

    const req = {
      body: { token: "change-token-xyz", newEmail: "new@example.com" },
    };
    const res = makeRes();
    await confirmEmailChange(req, res);

    const updateData = prismaMock.user.update.mock.calls[0][0].data;
    expect(updateData.pendingEmail).toBeNull();
    expect(updateData.verificationToken).toBeNull();
    expect(updateData.verificationTokenExpiry).toBeNull();
  });

  it("rejects the request when pendingEmail is not set on the user record", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      email: "old@example.com",
      pendingEmail: null, // no pending email stored
    });

    const req = {
      body: { token: "change-token-xyz", newEmail: "new@example.com" },
    };
    const res = makeRes();
    await confirmEmailChange(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 when the token is invalid or expired", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const req = {
      body: { token: "bad-token", newEmail: "new@example.com" },
    };
    const res = makeRes();
    await confirmEmailChange(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
