import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyA3cQ68IqgYTMe3tMJa1LjoDZa2fnHYFh0",
  authDomain: "dropguard-app-4f600.firebaseapp.com",
  projectId: "dropguard-app-4f600",
  storageBucket: "dropguard-app-4f600.firebasestorage.app",
  messagingSenderId: "975218892970",
  appId: "1:975218892970:web:928ad1b73d78ff66d570d3",
  measurementId: "G-6Q73P7QPRZ",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Secondary app used to create student accounts without signing the admin out
const secondaryApp =
  getApps().find((a) => a.name === "Secondary") ||
  initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);
