import crypto from "crypto";
import prisma from "../config/prisma.js";

/**
 * Constant-time comparison of two hex signature strings.
 * Returns false on length mismatch without leaking timing information.
 */
const signaturesMatch = (expectedHex, providedHex) => {
  if (typeof providedHex !== "string" || providedHex.length === 0) return false;
  const expected = Buffer.from(expectedHex, "utf8");
  const provided = Buffer.from(providedHex, "utf8");
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
};

export const handlePusherWebhook = async (req, res) => {
  const webhookSignature = req.headers["x-pusher-signature"];
  const webhookKey = req.headers["x-pusher-key"];
  const bodyBuffer = req.body;
  const bodyString = bodyBuffer.toString();

  // Reject webhooks signed for a different Pusher app key
  if (webhookKey !== process.env.PUSHER_KEY) {
    return res.status(401).json({ message: "Invalid webhook key" });
  }

  // Verify signature (constant-time)
  const expectedSignature = crypto
    .createHmac("sha256", process.env.PUSHER_SECRET)
    .update(bodyString)
    .digest("hex");

  if (!signaturesMatch(expectedSignature, webhookSignature)) {
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  try {
    const payload = JSON.parse(bodyString);
    const events = payload.events || [];

    for (const event of events) {
      if (event.name === "channel_occupied" || event.name === "channel_vacated") {
        const channelName = event.channel;
        
        // Channel format: private-user-<userId>
        if (channelName.startsWith("private-user-")) {
          const userId = channelName.replace("private-user-", "");
          
          if (event.name === "channel_occupied") {
            await prisma.user.update({
              where: { id: userId },
              data: { isOnline: true },
            }).catch(() => {});
          } else if (event.name === "channel_vacated") {
            await prisma.user.update({
              where: { id: userId },
              data: { isOnline: false, lastSeenAt: new Date() },
            }).catch(() => {});
          }
        }
      }
    }

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Pusher webhook error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
