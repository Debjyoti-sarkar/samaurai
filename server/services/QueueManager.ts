import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";

const QUEUE_KEY = "@kavach_queue_v1";

export type QueueItem = {
  id: string;                 // unique
  type: "send_money" | string;
  payload: any;               // what to send to backend
  createdAt: number;
  attempts?: number;
  idempotencyKey?: string;    // safe-retry header
};

async function readQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}
async function saveQueue(queue: QueueItem[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueue(item: Omit<QueueItem, "id" | "createdAt" | "attempts">) {
  const q = await readQueue();
  const entry: QueueItem = {
    ...item,
    id: uuidv4(),
    createdAt: Date.now(),
    attempts: 0,
    idempotencyKey: item.idempotencyKey || uuidv4(),
  };
  q.push(entry);
  await saveQueue(q);
  return entry;
}

export async function peekQueue() {
  return await readQueue();
}

export async function removeFromQueue(id: string) {
  const q = await readQueue();
  const filtered = q.filter((i) => i.id !== id);
  await saveQueue(filtered);
}

export async function updateQueueItem(item: QueueItem) {
  const q = await readQueue();
  const idx = q.findIndex((x) => x.id === item.id);
  if (idx >= 0) {
    q[idx] = item;
    await saveQueue(q);
  }
}
