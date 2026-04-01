"""
FastAPI Voice Assistant Backend
Run with: uvicorn fastapi_server:app --host 0.0.0.0 --port 3000 --reload
"""

import re
import time
import base64
import io
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from gtts import gTTS

app = FastAPI(
    title="KAVACH Voice Assistant API",
    description="Backend API for Voice Assistant with STT, NLU, and TTS",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Track server start time
START_TIME = time.time()


# ============ Models ============

class ParseRequest(BaseModel):
    text: str


class ParseResponse(BaseModel):
    intent: str
    entities: Dict[str, Any]
    confidence: float
    replyText: str
    actionSuggested: str


class TTSRequest(BaseModel):
    text: str
    lang: str = "en"


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    uptime: float


# ============ Health Check ============

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "uptime": time.time() - START_TIME
    }


@app.get("/ping")
async def ping():
    """Simple ping endpoint"""
    return {"ok": True}


# ============ Voice Assistant Endpoints ============

@app.post("/assistant/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Transcribe audio to text (Speech-to-Text)
    
    Currently returns a placeholder. 
    To enable real STT, install and configure:
    - whisper (OpenAI's free local model)
    - speech_recognition
    - google-cloud-speech
    """
    try:
        contents = await audio.read()
        
        # TODO: Integrate actual STT service
        # Example with OpenAI Whisper (local, free):
        # import whisper
        # model = whisper.load_model("base")
        # result = model.transcribe(audio_path)
        # return {"text": result["text"]}
        
        return {
            "text": "Audio received. Configure STT service for transcription.",
            "debug": {
                "filename": audio.filename,
                "size": len(contents),
                "content_type": audio.content_type
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.post("/assistant/parse", response_model=ParseResponse)
async def parse_text(request: ParseRequest):
    """
    Parse text for intent and entities (NLU)
    Uses rule-based matching. Replace with ML model for production.
    """
    text = request.text
    lower_text = text.lower()
    
    intent = "unknown"
    entities: Dict[str, Any] = {}
    reply_text = "I'm sorry, I didn't understand that. Can you please rephrase?"
    action_suggested = "none"
    confidence = 0.5
    
    # Intent detection rules
    
    # Send Money
    if any(word in lower_text for word in ["send", "pay", "transfer"]) or \
       (any(word in lower_text for word in ["rupees", "rs", "₹"]) and re.search(r'\d+', lower_text)):
        intent = "send_money"
        reply_text = "I'll help you send money. Opening the payment screen."
        action_suggested = "prefill_and_navigate_upi"
        confidence = 0.85
        
        # Extract amount
        amount_match = re.search(r'(\d+(?:\.\d{2})?)\s*(?:rupees?|rs\.?|₹)?', lower_text, re.IGNORECASE)
        if amount_match:
            entities["amount"] = amount_match.group(1)
            reply_text = f"I'll help you send ₹{amount_match.group(1)}. Opening the payment screen."
        
        # Extract recipient
        to_match = re.search(r'to\s+(\w+)', lower_text, re.IGNORECASE)
        if to_match:
            entities["recipient"] = to_match.group(1)
            if "amount" in entities:
                reply_text = f"I'll help you send ₹{entities['amount']} to {entities['recipient']}. Opening the payment screen."
            else:
                reply_text = f"I'll help you send money to {entities['recipient']}. Opening the payment screen."
    
    # Check Balance
    elif any(word in lower_text for word in ["balance", "how much", "account"]):
        intent = "check_balance"
        reply_text = "Let me show you your account balance. Please enter your PIN."
        action_suggested = "ask_pin_for_balance"
        confidence = 0.9
    
    # Transaction History
    elif any(word in lower_text for word in ["history", "transaction", "recent", "activity"]):
        intent = "view_history"
        reply_text = "Here are your recent transactions."
        action_suggested = "show_history"
        confidence = 0.85
    
    # Scan QR
    elif "scan" in lower_text and "qr" in lower_text:
        intent = "scan_qr"
        reply_text = "Opening the QR scanner for you."
        action_suggested = "scan_qr"
        confidence = 0.9
    
    # Fraud Check
    elif any(word in lower_text for word in ["fraud", "scam", "suspicious", "fake"]):
        intent = "check_fraud"
        reply_text = "Let me check this for potential fraud."
        action_suggested = "check_fraud"
        confidence = 0.85
    
    # Help
    elif any(word in lower_text for word in ["help", "support", "settings", "assist"]):
        intent = "help"
        reply_text = "Opening the help and settings page."
        action_suggested = "help_support_page"
        confidence = 0.8
    
    # Greeting
    elif any(word in lower_text for word in ["hello", "hi", "hey", "good morning", "good evening"]):
        intent = "greeting"
        reply_text = "Hello! How can I help you today? You can ask me to send money, check balance, view transactions, or scan a QR code."
        action_suggested = "none"
        confidence = 0.95
    
    # Thank you
    elif any(word in lower_text for word in ["thank", "thanks", "bye", "goodbye"]):
        intent = "farewell"
        reply_text = "You're welcome! Have a great day!"
        action_suggested = "none"
        confidence = 0.9
    
    return ParseResponse(
        intent=intent,
        entities=entities,
        confidence=confidence,
        replyText=reply_text,
        actionSuggested=action_suggested
    )


@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    """
    Convert text to speech using gTTS (Google Text-to-Speech - Free)
    Returns base64 encoded MP3 audio
    """
    try:
        # Map language codes
        lang_map = {
            "en-IN": "en",
            "en-US": "en", 
            "en": "en",
            "hi": "hi",
            "or": "or",
        }
        lang = lang_map.get(request.lang, "en")
        
        # Generate speech
        tts = gTTS(text=request.text, lang=lang, slow=False)
        
        # Save to bytes buffer
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        
        # Convert to base64
        audio_base64 = base64.b64encode(audio_buffer.read()).decode('utf-8')
        
        return {
            "audio": audio_base64,
            "format": "mp3",
            "lang": lang
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")


# ============ Run Server ============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
