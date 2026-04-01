import { BASE_URL } from "@/services/api";

const TRACK_ENDPOINT = "/api/track";

export async function trackActivity(data) {
  if (!data?.accountId || !data?.timestamp || !data?.userId) {
    throw new Error("trackActivity requires accountId, timestamp, and userId");
  }

  const response = await fetch(`${BASE_URL}${TRACK_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to track activity: ${response.status}`);
  }

  return response.json().catch(() => null);
}

export default trackActivity;