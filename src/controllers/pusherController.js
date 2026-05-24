import crypto from "crypto";
import prisma from "../config/prisma.js";

export const handlePusherWebhook = async (req, res) => {
  const webhookSignature = req.headers["x-pusher-signature"];
  const bodyBuffer = req.body;
  const bodyString = bodyBuffer.toString();

  // Verify signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.PUSHER_SECRET)
    .update(bodyString)
    .digest("hex");

  if (expectedSignature !== webhookSignature) {
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
