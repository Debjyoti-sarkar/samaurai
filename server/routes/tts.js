// server/routes/tts.js
import express from "express";
import path from "path";
import dotenv from "dotenv";
import textToSpeech from "@google-cloud/text-to-speech";
dotenv.config();

export const ttsRouter = express.Router();

// -----------------------------------------------
// GOOGLE TTS CLIENT
// -----------------------------------------------
const googleClient = new textToSpeech.TextToSpeechClient({
  keyFilename: path.join(process.cwd(), "google_key.json"),
});

// Indian voices
const GOOGLE_VOICE_MAP = {
  "hi-IN": "hi-IN-Wavenet-C",   // ⭐ BEST natural Hindi female
  "hi-IN-male": "hi-IN-Wavenet-D",
  "en-IN": "en-IN-Wavenet-C",
  "mr-IN": "mr-IN-Wavenet-A",
  "ta-IN": "ta-IN-Wavenet-A",
  "te-IN": "te-IN-Wavenet-A",
  "kn-IN": "kn-IN-Wavenet-A",
  "ml-IN": "ml-IN-Wavenet-A",
  "or-IN": "or-IN-Wavenet-A",
  "en-US": "en-US-Wavenet-H",
};

// -------------------------------------------------------
// ⭐ MAIN TTS ROUTE (ONLY GOOGLE — maximum natural Hindi)
// -------------------------------------------------------
ttsRouter.post("/", async (req, res) => {
  try {
    const { text, languageCode } = req.body;

    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }

    const lang = languageCode || "hi-IN";

    const voiceName =
      GOOGLE_VOICE_MAP[lang] || GOOGLE_VOICE_MAP["hi-IN"];

    const request = {
      input: { text },
      voice: {
        languageCode: lang,
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
        pitch: 0.0,
      },
    };

    const [response] = await googleClient.synthesizeSpeech(request);

    return res.json({
      ok: true,
      engine: "google-tts",
      audioBase64: response.audioContent.toString("base64"),
    });
  } catch (err) {
    console.error("TTS ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "TTS failed",
      details: err.message,
    });
  }
});