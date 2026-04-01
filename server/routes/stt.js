// server/routes/stt.js
// REAL Whisper.cpp Node transcription (offline, free)

const express = require("express");
const router = express.Router();
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const whisper = require("whisper-node");
const fs = require("fs");
const path = require("path");

// Configure ffmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath);

// Temp upload directory
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer upload config
const upload = multer({
  dest: uploadDir,
});

// Load Whisper model once
let model = null;
let modelLoading = false;

async function loadModel() {
  if (model) return model;
  if (modelLoading) {
    while (!model) await new Promise(r => setTimeout(r, 100));
    return model;
  }

  modelLoading = true;
  console.log("Loading Whisper model (tiny)…");
  model = await whisper.loadModel("tiny"); // Options: tiny, base, small
  console.log("Whisper model loaded.");
  return model;
}

// Audio conversion helper
function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(["-ar 16000", "-ac 1", "-vn"])
      .save(outputPath)
      .on("end", () => resolve(true))
      .on("error", reject);
  });
}

// 🟦 POST /assistant/transcribe
router.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded (field name must be 'audio')" });
    }

    const inputPath = req.file.path;
    const wavPath = inputPath + ".wav";

    // Convert uploaded audio to WAV
    await convertToWav(inputPath, wavPath);

    // Load whisper model
    const whisperModel = await loadModel();

    // Run transcription
    const result = await whisper.transcribe({
      model: whisperModel,
      file: wavPath,
      full: false,
    });

    const transcript = result.text || "";

    // Cleanup
    fs.unlinkSync(inputPath);
    fs.unlinkSync(wavPath);

    return res.json({ text: transcript });

  } catch (err) {
    console.error("STT ERROR:", err);
    return res.status(500).json({ error: "STT failed", details: err.message });
  }
});

module.exports = router;
