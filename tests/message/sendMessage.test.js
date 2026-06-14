import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- mocks ----------
const prismaMock = {
  conversation: { findUnique: vi.fn(), update: vi.fn() },
  message: { create: vi.fn(), updateMany: vi.fn() },
  user: { update: vi.fn() },
  $transaction: vi.fn(),
};
vi.mock("../../src/config/prisma.js", () => ({ default: prismaMock }));

const pushEventMock = vi.fn();
vi.mock("../../src/config/pusher.js", () => ({ pushEvent: pushEventMock }));

const createMessageNotificationMock = vi.fn();
vi.mock("../../src/controllers/notificationController.js", () => ({
  createMessageNotification: createMessageNotificationMock,
}));

const sendNewMessageEmailMock = vi.fn();
vi.mock("../../src/services/emailService.js", () => ({
  sendNewMessageEmail: sendNewMessageEmailMock,
}));

const { sendMessage } = await import("../../src/controllers/messageController.js");

// ---------- helpers ----------
const makeConversation = (overrides = {}) => ({
  id: "conv-1",
  participantAId: "user-sender",
  participantBId: "user-receiver",
  listingId: null,
  listing: { id: "list-1", title: "Tomatoes" },
  participantA: {
    id: "user-sender",
    email: "sender@example.com",
    fullName: "Alice",
    isOnline: false,
    lastMessageEmailSentAt: null,
  },
  participantB: {
    id: "user-receiver",
    email: "receiver@example.com",
    fullName: "Bob",
    isOnline: false,
    lastMessageEmailSentAt: null,
  },
  ...overrides,
});

const makeReq = (overrides = {}) => ({
  user: { id: "user-sender" },
  params: { conversationId: "conv-1" },
  body: { content: "Hello there" },
  ...overrides,
});

const makeRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const createdMessage = { id: "msg-1", content: "Hello there" };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.conversation.findUnique.mockResolvedValue(makeConversation());
  prismaMock.$transaction.mockResolvedValue([createdMessage, {}]);
  pushEventMock.mockResolvedValue();
  createMessageNotificationMock.mockResolvedValue();
  sendNewMessageEmailMock.mockResolvedValue();
  prismaMock.user.update.mockResolvedValue({});
});

describe("sendMessage — email notification parameters", () => {
  it("calls sendNewMessageEmail with `email` (not `to`) and `recipientName`", async () => {
    const req = makeReq();
    const res = makeRes();
    await sendMessage(req, res);

    expect(sendNewMessageEmailMock).toHaveBeenCalledOnce();
    const callArg = sendNewMessageEmailMock.mock.calls[0][0];

    // Must use `email` key, not `to`
    expect(callArg).toHaveProperty("email", "receiver@example.com");
    expect(callArg).not.toHaveProperty("to");

    // Must include recipientName
    expect(callArg).toHaveProperty("recipientName", "Bob");
  });

  it("does NOT send email when receiver is online", async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(
      makeConversation({
        participantB: {
          id: "user-receiver",
          email: "receiver@example.com",
          fullName: "Bob",
          isOnline: true,
          lastMessageEmailSentAt: null,
        },
      }),
    );

    const req = makeReq();
    const res = makeRes();
    await sendMessage(req, res);

    expect(sendNewMessageEmailMock).not.toHaveBeenCalled();
  });

  it("does NOT send email when one was sent within the last 5 minutes", async () => {
    const recentlySent = new Date(Date.now() - 2 * 60 * 1000); // 2 min ago
    prismaMock.conversation.findUnique.mockResolvedValue(
      makeConversation({
        participantB: {
          id: "user-receiver",
          email: "receiver@example.com",
          fullName: "Bob",
          isOnline: false,
          lastMessageEmailSentAt: recentlySent,
        },
      }),
    );

    const req = makeReq();
    const res = makeRes();
    await sendMessage(req, res);

    expect(sendNewMessageEmailMock).not.toHaveBeenCalled();
  });
});
