import { db } from "../lib/firebase";
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    serverTimestamp,
    collection
} from "firebase/firestore";

const MASTER_KEY = "MEU_ROBO_ADMIN";

export const validateLicense = async (key: string): Promise<{ status: 'admin' | 'valid' | 'invalid' }> => {
    if (!key) return { status: 'invalid' };

    // 1. Check Master Key (Hardcoded for convenience or could be in DB too)
    if (key === MASTER_KEY) {
        return { status: 'admin' };
    }

    try {
        const licenseRef = doc(db, "licenses", key);
        const licenseSnap = await getDoc(licenseRef);

        if (licenseSnap.exists()) {
            const data = licenseSnap.data();
            if (!data.used) {
                return { status: 'valid' };
            }
        }
    } catch (e: any) {
        if (e.code === 'permission-denied') {
            console.error("ERRO FIREBASE: Você precisa habilitar o Firestore e definir as REGRAS para 'allow read, write: if true' no seu console.");
        } else {
            console.error("Erro ao validar no Firebase:", e);
        }
    }
    
    return { status: 'invalid' };
};

export const burnLicense = async (key: string): Promise<boolean> => {
    if (key === MASTER_KEY) return true; // Master key is infinite
    
    try {
        const licenseRef = doc(db, "licenses", key);
        await updateDoc(licenseRef, {
            used: true,
            usedAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Erro ao queimar chave:", e);
        return false;
    }
};

export const generateNewLicense = async (adminKey: string): Promise<string | null> => {
    if (adminKey !== MASTER_KEY) return null;

    try {
        // Generate a random 8-char hex key
        const newKey = Math.random().toString(16).substring(2, 10).toUpperCase();
        
        const licenseRef = doc(db, "licenses", newKey);
        await setDoc(licenseRef, {
            id: newKey,
            used: false,
            created: serverTimestamp(),
            type: 'user'
        });
        
        return newKey;
    } catch (e) {
        console.error("Erro ao gerar chave no Firebase:", e);
        return null;
    }
};
