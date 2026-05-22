import Pusher from "pusher";

let pusherInstance = null;

export const getPusher = () => {
  if (!pusherInstance) {
    const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } =
      process.env;
    if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
      throw new Error("Pusher environment variables are not configured");
    }
    pusherInstance = new Pusher({
      appId: PUSHER_APP_ID,
      key: PUSHER_KEY,
      secret: PUSHER_SECRET,
      cluster: PUSHER_CLUSTER,
      useTLS: true,
    });
  }
  return pusherInstance;
};

/**
 * Emit an event on a Pusher channel.
 * Swallows errors to avoid crashing the API when Pusher is unavailable.
 */
export const pushEvent = async (channel, event, data) => {
  if (!process.env.PUSHER_APP_ID) return; // Pusher not configured – skip silently
  try {
    const pusher = getPusher();
    await pusher.trigger(channel, event, data);
  } catch (err) {
    console.error(`Pusher emit failed [${channel}/${event}]:`, err.message);
  }
};
