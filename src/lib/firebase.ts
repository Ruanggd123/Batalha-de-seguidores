import { initializeApp, getApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAnalytics, isSupported } from "firebase/analytics";

// Configuração fornecida pelo usuário
const firebaseConfig = {
  apiKey: "AIzaSyBD128ikoJKYlyb07X5e4AQXb-v8bWJGZ4",
  authDomain: "keys-6d05b.firebaseapp.com",
  projectId: "keys-6d05b",
  storageBucket: "keys-6d05b.firebasestorage.app",
  messagingSenderId: "124794636811",
  appId: "1:124794636811:web:22405926b9954c0d52950e",
  measurementId: "G-CEN4M48SZ8",
  databaseURL: "https://keys-6d05b-default-rtdb.firebaseio.com/"
};

// Inicializa Firebase (Singleton pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const database = getDatabase(app);

// Analytics só funciona no browser e se suportado
export const analytics = typeof window !== 'undefined' 
  ? isSupported().then(yes => yes ? getAnalytics(app) : null).catch(() => null)
  : null;

export default app;

