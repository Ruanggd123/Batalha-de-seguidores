import { database } from "../lib/firebase";
import { 
    ref, 
    get, 
    set, 
    update, 
    child
} from "firebase/database";

const MASTER_KEY = "MEU_ROBO_ADMIN";

export const validateLicense = async (key: string): Promise<{ status: 'admin' | 'valid' | 'invalid' }> => {
    if (!key) return { status: 'invalid' };

    // 1. Check Master Key (Hardcoded)
    if (key === MASTER_KEY) {
        return { status: 'admin' };
    }

    try {
        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, `licenses/${key}`));

        if (snapshot.exists()) {
            const data = snapshot.val();
            if (!data.used) {
                return { status: 'valid' };
            }
        }
    } catch (e: any) {
        if (e.message?.includes('permission_denied')) {
            console.error("ERRO FIREBASE: Você precisa habilitar o REALTIME DATABASE e definir as REGRAS para 'allow read, write: if true' no seu console.");
        } else {
            console.error("Erro ao validar no Firebase (Realtime Database):", e);
        }
    }
    
    return { status: 'invalid' };
};

export const burnLicense = async (key: string): Promise<boolean> => {
    if (key === MASTER_KEY) return true; // Master key is infinite
    
    try {
        const licenseRef = ref(database, `licenses/${key}`);
        await update(licenseRef, {
            used: true,
            usedAt: Date.now()
        });
        return true;
    } catch (e) {
        console.error("Erro ao queimar chave no Firebase:", e);
        return false;
    }
};

export const generateNewLicense = async (adminKey: string): Promise<string | null> => {
    if (adminKey !== MASTER_KEY) return null;

    try {
        // Generate a random 8-char hex key
        const newKey = Math.random().toString(16).substring(2, 10).toUpperCase();
        
        const licenseRef = ref(database, `licenses/${newKey}`);
        await set(licenseRef, {
            id: newKey,
            used: false,
            created: Date.now(),
            type: 'user'
        });
        
        return newKey;
    } catch (e) {
        console.error("Erro ao gerar chave no Firebase (Realtime Database):", e);
        return null;
    }
};
