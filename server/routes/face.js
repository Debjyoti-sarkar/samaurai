import express from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FACE_DATA_DIR = path.join(__dirname, "..", "data", "faces");
const FACE_API_ENDPOINT = (process.env.AZURE_FACE_ENDPOINT || "").replace(
  /\/+$/,
  "",
);
const FACE_API_KEY = process.env.AZURE_FACE_API_KEY || "";
const FACE_VERIFY_THRESHOLD = Number(
  process.env.FACE_VERIFY_MIN_CONFIDENCE || "0.65",
);

function sanitizeUserId(userId = "") {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
}

function getFaceImagePath(userId) {
  return path.join(FACE_DATA_DIR, `${sanitizeUserId(userId)}.jpg`);
}

async function ensureDataDir() {
  await fs.mkdir(FACE_DATA_DIR, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertFaceApiConfigured() {
  if (!FACE_API_ENDPOINT || !FACE_API_KEY) {
    const error = new Error(
      "Face recognition backend is not configured. Set AZURE_FACE_ENDPOINT and AZURE_FACE_API_KEY.",
    );
    error.statusCode = 503;
    throw error;
  }
}

async function detectFace(buffer) {
  assertFaceApiConfigured();

  const detectUrl = new URL(`${FACE_API_ENDPOINT}/face/v1.0/detect`);
  detectUrl.searchParams.set("returnFaceId", "true");
  detectUrl.searchParams.set("detectionModel", "detection_03");
  detectUrl.searchParams.set("recognitionModel", "recognition_04");

  const response = await fetch(detectUrl, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": FACE_API_KEY,
      "Content-Type": "application/octet-stream",
    },
    body: buffer,
  });

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    const message = data?.error?.message || "Face detection failed";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  if (!Array.isArray(data) || data.length !== 1) {
    const error = new Error(
      "Exactly one clear face must be visible in the frame.",
    );
    error.statusCode = 400;
    throw error;
  }

  return data[0];
}

async function verifyFaces(faceId1, faceId2) {
  assertFaceApiConfigured();

  const response = await fetch(`${FACE_API_ENDPOINT}/face/v1.0/verify`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": FACE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ faceId1, faceId2 }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || "Face verification failed";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

router.get("/status/:userId", async (req, res) => {
  const filePath = getFaceImagePath(req.params.userId);
  const enrolled = await fileExists(filePath);
  res.json({ success: true, enrolled });
});

router.post("/enroll", upload.single("image"), async (req, res) => {
  try {
    const userId = String(req.body?.userId || "");
    if (!userId || !req.file?.buffer) {
      return res
        .status(400)
        .json({ success: false, message: "userId and image are required" });
    }

    await detectFace(req.file.buffer);
    await ensureDataDir();
    await fs.writeFile(getFaceImagePath(userId), req.file.buffer);

    res.json({
      success: true,
      enrolled: true,
      message: "Face enrolled successfully",
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Face enrollment failed",
    });
  }
});

router.post("/verify", upload.single("image"), async (req, res) => {
  try {
    const userId = String(req.body?.userId || "");
    if (!userId || !req.file?.buffer) {
      return res
        .status(400)
        .json({ success: false, message: "userId and image are required" });
    }

    const enrolledPath = getFaceImagePath(userId);
    if (!(await fileExists(enrolledPath))) {
      return res.status(404).json({
        success: false,
        enrolled: false,
        message: "No enrolled face found for this user",
      });
    }

    const [candidateFace, enrolledFace] = await Promise.all([
      detectFace(req.file.buffer),
      fs.readFile(enrolledPath).then(detectFace),
    ]);

    const verification = await verifyFaces(
      candidateFace.faceId,
      enrolledFace.faceId,
    );
    const confidence = Number(verification.confidence || 0);
    const matched =
      Boolean(verification.isIdentical) && confidence >= FACE_VERIFY_THRESHOLD;
    const message = matched
      ? "Face verified"
      : verification.isIdentical
        ? `Low confidence match (${confidence.toFixed(2)}). Please retry in better lighting.`
        : "Face did not match the enrolled profile";

    res.json({
      success: true,
      enrolled: true,
      matched,
      confidence,
      threshold: FACE_VERIFY_THRESHOLD,
      message,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Face verification failed",
    });
  }
});

export default router;
