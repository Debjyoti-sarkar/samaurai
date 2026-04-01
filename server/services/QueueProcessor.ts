import { peekQueue, removeFromQueue, updateQueueItem, QueueItem } from "./QueueManager";
import { BASE_URL } from "../../services/assistant";

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000; // delay between retries for each attempt (can be exponential)

async function sendToBackend(item: QueueItem) {
  // adapt to your backend path
  const BASE = BASE_URL;
  if (item.type === "send_money") {
    // payload should contain amount, recipient, etc.
    const resp = await fetch(`${BASE}/api/payment/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": item.idempotencyKey || item.id,
      },
      body: JSON.stringify(item.payload),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${text}`);
    }
    return await resp.json();
  }

  // other item types...
  return null;
}

export async function processQueueOnce() {
  const q = await peekQueue();
  for (const item of q) {
    try {
      // Optional: throttle attempts
      if ((item.attempts || 0) >= MAX_ATTEMPTS) {
        // give up or notify user
        await removeFromQueue(item.id);
        continue;
      }

      item.attempts = (item.attempts || 0) + 1;
      await updateQueueItem(item);

      await sendToBackend(item);

      // success — remove item
      await removeFromQueue(item.id);
    } catch (err) {
      console.warn("Queue item failed:", item.id, err);
      // leave in queue, will retry later; could implement backoff
      // small delay before next item to avoid hammering
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}
