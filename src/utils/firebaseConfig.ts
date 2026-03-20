import { getAnalytics, isSupported, setAnalyticsCollectionEnabled } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { DEMO_MODE_ENABLED } from "@/config/appInfo";

const requiredFirebaseEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
} as const;

const missingFirebaseEnv = Object.entries(requiredFirebaseEnv)
  .filter(([, value]) => typeof value !== "string" || value.trim().length === 0)
  .map(([key]) => key);

if (missingFirebaseEnv.length > 0 && !DEMO_MODE_ENABLED) {
  throw new Error(
    `Missing Firebase environment variables: ${missingFirebaseEnv.join(", ")}`,
  );
}

const demoFirebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo-catering-dashboard.firebaseapp.com",
  projectId: "demo-catering-dashboard",
  storageBucket: "demo-catering-dashboard.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:demo-catering-dashboard",
  measurementId: undefined,
};

const firebaseConfig =
  missingFirebaseEnv.length > 0
    ? demoFirebaseConfig
    : {
        ...requiredFirebaseEnv,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
      };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getFirestore(app);
const storage = getStorage(app);

void isSupported().then((supported) => {
  if (!supported || !firebaseConfig.measurementId || missingFirebaseEnv.length > 0) return;
  const analytics = getAnalytics(app);
  setAnalyticsCollectionEnabled(analytics, true);
});

export { app, auth, database, storage };
