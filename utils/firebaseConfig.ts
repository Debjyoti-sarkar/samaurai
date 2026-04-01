// utils/firebaseConfig.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyCWVRuKqklAk1w86CCG8pBu16n_mgYy2YM",
  authDomain: "kavach-948e8.firebaseapp.com",
  projectId: "kavach-948e8",
  storageBucket: "kavach-948e8.firebasestorage.app",
  messagingSenderId: "66175020848",
  appId: "1:66175020848:web:80c9eb920e3b0a345022f5",
  measurementId: "G-0643THWYHB"
};

// Initialize Firebase app (singleton pattern)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with persistence for React Native
let auth: ReturnType<typeof getAuth>;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  // Use AsyncStorage for persistence on mobile
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    // Auth already initialized
    auth = getAuth(app);
  }
}

export { auth };