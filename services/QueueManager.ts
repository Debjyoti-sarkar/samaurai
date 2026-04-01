import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";

const QUEUE_KEY = "@kavach_transaction_queue";

export interface QueueItem {
  id: string;
  type: string;
  payload: any;
  idempotencyKey: string;
  attempts?: number;
  createdAt: string;
}

/**
 * Add an item to the queue
 */
export async function enqueue(item: Omit<QueueItem, "id" | "createdAt">): Promise<QueueItem> {
  try {
    const queue = await peekQueue();
    const newItem: QueueItem = {
      ...item,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    
    queue.push(newItem);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    console.log("✅ Item enqueued:", newItem.id);
    return newItem;
  } catch (error) {
    console.error("❌ Enqueue error:", error);
    throw error;
  }
}

/**
 * Get all items in the queue without removing them
 */
export async function peekQueue(): Promise<QueueItem[]> {
  try {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("❌ Peek queue error:", error);
    return [];
  }
}

/**
 * Remove an item from the queue by ID
 */
export async function removeFromQueue(itemId: string): Promise<void> {
  try {
    const queue = await peekQueue();
    const filtered = queue.filter((item) => item.id !== itemId);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    console.log("✅ Item removed from queue:", itemId);
  } catch (error) {
    console.error("❌ Remove from queue error:", error);
    throw error;
  }
}

/**
 * Update an item in the queue
 */
export async function updateQueueItem(updatedItem: QueueItem): Promise<void> {
  try {
    const queue = await peekQueue();
    const index = queue.findIndex((item) => item.id === updatedItem.id);
    
    if (index !== -1) {
      queue[index] = updatedItem;
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      console.log("✅ Queue item updated:", updatedItem.id);
    }
  } catch (error) {
    console.error("❌ Update queue item error:", error);
    throw error;
  }
}

/**
 * Clear all items from the queue
 */
export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
    console.log("✅ Queue cleared");
  } catch (error) {
    console.error("❌ Clear queue error:", error);
    throw error;
  }
}

/**
 * Get the count of items in the queue
 */
export async function getQueueCount(): Promise<number> {
  try {
    const queue = await peekQueue();
    return queue.length;
  } catch (error) {
    console.error("❌ Get queue count error:", error);
    return 0;
  }
}
