import { BASE_URL } from "@/services/assistant";

const FACE_BASE_URL = `${BASE_URL}/api/face`;

export interface FaceVerificationResult {
  success: boolean;
  matched?: boolean;
  enrolled?: boolean;
  confidence?: number;
  threshold?: number;
  message?: string;
}

async function postFaceImage(
  endpoint: string,
  userId: string,
  imageUri: string,
): Promise<FaceVerificationResult> {
  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "face.jpg";

  formData.append("userId", userId);
  formData.append("image", {
    uri: imageUri,
    name: filename,
    type: "image/jpeg",
  } as any);

  const response = await fetch(`${FACE_BASE_URL}${endpoint}`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || `Face API failed: ${response.status}`,
    );
  }

  return data;
}

export async function enrollFace(userId: string, imageUri: string) {
  return postFaceImage("/enroll", userId, imageUri);
}

export async function verifyFace(userId: string, imageUri: string) {
  return postFaceImage("/verify", userId, imageUri);
}

export async function getFaceEnrollmentStatus(userId: string) {
  const response = await fetch(
    `${FACE_BASE_URL}/status/${encodeURIComponent(userId)}`,
    { method: "GET" },
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || `Face status failed: ${response.status}`,
    );
  }

  return data as FaceVerificationResult;
}
