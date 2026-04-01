import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Import translation files
import en from "../assets/locales/en.json";
import hi from "../assets/locales/hi.json";
// Add more language imports as needed

const LANGUAGE_STORAGE_KEY = "user_language";

// Language detector for React Native
const languageDetector = {
  type: "languageDetector",
  async: true,
  detect: async (callback) => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage) {
        return callback(savedLanguage);
      }
      return callback("en"); // Default language
    } catch (error) {
      console.error("Error detecting language:", error);
      return callback("en");
    }
  },
  init: () => {},
  cacheUserLanguage: async (language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (error) {
      console.error("Error caching language:", error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: "v3",
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      // Add more languages here
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिंदी" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "or", name: "Odia", nativeName: "ଓଡିଆ" },
  { code: "as", name: "Assamese", nativeName: "অসমীয়া" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
  { code: "sa", name: "Sanskrit", nativeName: "संस्कृत" },
  { code: "ks", name: "Kashmiri", nativeName: "कॉशुर" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली" },
  { code: "sd", name: "Sindhi", nativeName: "سنڌي" },
  { code: "ko", name: "Konkani", nativeName: "कोंकणी" },
  { code: "mt", name: "Manipuri", nativeName: "মৈতৈলোন্" },
  { code: "bo", name: "Bodo", nativeName: "बड़ो" },
  { code: "dg", name: "Dogri", nativeName: "डोगरी" },
  { code: "st", name: "Santhali", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ" },
];

export const changeLanguage = async (languageCode) => {
  await i18n.changeLanguage(languageCode);
};
