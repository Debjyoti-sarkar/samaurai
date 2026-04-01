// Your backend is running on PORT 3001 (NOT 3000)
export const BASE_URL = "https://curvy-sides-carry.loca.lt";

export const TRANSCRIBE_URL = BASE_URL + "/assistant/transcribe";
export const PARSE_URL = BASE_URL + "/assistant/parse";
export const HEALTH_URL = BASE_URL + "/health";

// Types for API responses
export interface ParseResponse {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  detectedLanguage?: string;
  replyText: string;
  replyTextEnglish?: string;
  actionSuggested: string;
}

// Language code to TTS language mapping (All 22 Indian Languages + English)
export const LANGUAGE_TTS_MAP: Record<string, string> = {
  // English
  'en': 'en-IN',
  'en-US': 'en-US',

  // Hindi & Hinglish
  'hi': 'hi-IN',
  'hi-en': 'hi-IN',

  // Major Indian Languages (with TTS support)
  'bn': 'bn-IN',    // Bengali (বাংলা)
  'ta': 'ta-IN',    // Tamil (தமிழ்)
  'te': 'te-IN',    // Telugu (తెలుగు)
  'mr': 'mr-IN',    // Marathi (मराठी)
  'gu': 'gu-IN',    // Gujarati (ગુજરાતી)
  'kn': 'kn-IN',    // Kannada (ಕನ್ನಡ)
  'ml': 'ml-IN',    // Malayalam (മലയാളം)
  'pa': 'pa-IN',    // Punjabi (ਪੰਜਾਬੀ)
  'ur': 'ur-IN',    // Urdu (اردو)
  'or': 'or-IN',    // Odia (ଓଡ଼ିଆ)

  // Languages that may fallback to Hindi TTS (similar script/phonetics)
  'as': 'bn-IN',    // Assamese (অসমীয়া) - similar to Bengali
  'mai': 'hi-IN',   // Maithili (मैथिली) - Devanagari script
  'ne': 'hi-IN',    // Nepali (नेपाली) - Devanagari script
  'kok': 'hi-IN',   // Konkani (कोंकणी) - Devanagari script
  'doi': 'hi-IN',   // Dogri (डोगरी) - Devanagari script
  'sa': 'hi-IN',    // Sanskrit (संस्कृतम्) - Devanagari script
  'brx': 'hi-IN',   // Bodo (बड़ो) - Devanagari script

  // Languages with limited TTS support (fallback to closest)
  'ks': 'ur-IN',    // Kashmiri (कॉशुर) - close to Urdu
  'sd': 'ur-IN',    // Sindhi (سنڌي) - close to Urdu
  'mni': 'bn-IN',   // Manipuri (মৈতৈলোন্) - Bengali script variant
  'sat': 'hi-IN',   // Santali (ᱥᱟᱱᱛᱟᱲᱤ) - fallback to Hindi

  // Regional dialects (fallback to parent language)
  'bho': 'hi-IN',   // Bhojpuri
  'raj': 'hi-IN',   // Rajasthani
  'cg': 'hi-IN',    // Chhattisgarhi
  'hne': 'hi-IN',   // Haryanvi
  'mag': 'hi-IN',   // Magahi

  // Mixed languages
  'ta-en': 'ta-IN', // Tanglish
  'bn-en': 'bn-IN', // Benglish
  'te-en': 'te-IN', // Telugu-English
  'ml-en': 'ml-IN', // Malayalam-English

  // Default fallback
  'unknown': 'en-IN',
};

/**
 * Get TTS language code from detected language
 */
export function getTTSLanguage(detectedLanguage?: string): string {
  if (!detectedLanguage) return 'en-IN';
  return LANGUAGE_TTS_MAP[detectedLanguage] || 'en-IN';
}

export interface TranscribeResponse {
  text: string;
}

export interface HealthResponse {
  status: string;
  timestamp?: string;
  uptime?: number;
}

/**
 * Parse text using the backend NLU
 * @param text - The text to parse
 * @returns ParseResponse with intent, entities, confidence, replyText, and actionSuggested
 */
export async function parseText(text: string): Promise<ParseResponse> {
  try {
    const response = await fetch(PARSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Parse request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error parsing text:', error);
    throw error;
  }
}

/**
 * Transcribe audio file using the backend STT service
 * @param audioUri - The URI of the audio file to transcribe
 * @returns TranscribeResponse with transcribed text
 */
export async function transcribeAudio(audioUri: string): Promise<TranscribeResponse> {
  try {
    const formData = new FormData();

    const filename = audioUri.split('/').pop() || 'recording.m4a';

    // Correct Expo upload behavior → DO NOT SET Content-Type manually
    formData.append('audio', {
      uri: audioUri,
      name: filename,
      type: 'audio/m4a',
    } as any);

    const response = await fetch(TRANSCRIBE_URL, {
      method: 'POST',
      body: formData,    // No headers → let RN set boundary correctly
    });

    if (!response.ok) {
      throw new Error(`Transcribe request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

/**
 * Check backend health status
 * @returns HealthResponse with status and optional metadata
 */
export async function healthCheck(): Promise<HealthResponse> {
  try {
    const response = await fetch(HEALTH_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking health:', error);
    throw error;
  }
}
