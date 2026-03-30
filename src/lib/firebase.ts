import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Configuração fornecida pelo usuário
const firebaseConfig = {
  apiKey: "AIzaSyBD128ikoJKYlyb07X5e4AQXb-v8bWJGZ4",
  authDomain: "keys-6d05b.firebaseapp.com",
  projectId: "keys-6d05b",
  storageBucket: "keys-6d05b.firebasestorage.app",
  messagingSenderId: "124794636811",
  appId: "1:124794636811:web:22405926b9954c0d52950e",
  measurementId: "G-CEN4M48SZ8"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;
