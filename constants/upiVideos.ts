// src/constants/upiVideos.ts

export type VideoItem = {
  id: string; 
  title: string;
  lang: string; 
  source?: string;
};

const videos: VideoItem[] = [
  // Hindi – full explanation video
  {
    id: "DYQ8b-dANK0",
    title: "UPI क्या है, इसका उपयोग कैसे करें और धोखाधड़ी से कैसे बचें",
    lang: "hi",
    source: "NPCI Official"
  },

  // English – full consolidated video
  {
    id: "DYQ8b-dANK0",
    title: "What is UPI & How to Use It Safely | Complete Guide",
    lang: "en",
    source: "NPCI Official"
  },

  // Kannada – safety + basics combined awareness video
  {
    id: "RyR_Qd_N2Xw",
    title: "UPI ಉಪಯೋಗಿಸುವ ವಿಧಾನ & ಮೋಸವನ್ನು ತಡೆಯುವುದು",
    lang: "kn",
    source: "NPCI Official"
  },

  // Tamil
  {
    id: "8Qg3CdVeXBg",
    title: "UPI என்ன? பாதுகாப்பாக பயன்படுத்துவது எப்படி?",
    lang: "ta",
    source: "NPCI Official"
  },

  // Telugu
  {
    id: "8Qg3CdVeXBg",
    title: "UPI అంటే ఏమిటి? భద్రంగా ఎలా ఉపయోగించాలి?",
    lang: "te",
    source: "NPCI Official"
  },

  // Malayalam
  {
    id: "8Qg3CdVeXBg",
    title: "UPI എന്താണ്? സുരക്ഷിതമായി ഉപയോഗിക്കുന്ന വിധം",
    lang: "ml",
    source: "NPCI Official"
  }
];

export default videos;
