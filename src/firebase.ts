import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyDoNXALcDqWf68M6zeNf24xNu3fDWhEDmQ",
  authDomain: "ruhansa-testapp.firebaseapp.com",
  projectId: "ruhansa-testapp",
  storageBucket: "ruhansa-testapp.firebasestorage.app",
  messagingSenderId: "52270647708",
  appId: "1:52270647708:web:cd743e2957cf42d7336059",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Secondary app used to create student accounts without signing the admin out
const secondaryApp =
  getApps().find((a) => a.name === "Secondary") ||
  initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);
