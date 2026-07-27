import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  persistentSingleTabManager,
  type Firestore
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Cache local persistente (IndexedDB): la agenda abre al instante con los datos
// ya conocidos en el dispositivo y sincroniza en segundo plano. Clave para que
// la PWA no re-descargue cientos de documentos en cada arranque (iPhone lento).
// Si el navegador no lo soporta (p. ej. modo privado), cae a memoria como antes.
// IMPORTANTE (iPhone): el modo multi-pestaña necesita coordinación entre pestañas y
// en Safari/PWA falla con frecuencia. Antes, al fallar, se caía DIRECTO a memoria: sin
// caché, la agenda re-descargaba todo en cada apertura (por eso el iPhone iba lento).
// Ahora hay un escalón intermedio: una sola pestaña, que es justo el caso de una app
// instalada en el celular. Solo si eso también falla se usa memoria.
let firestore: Firestore;
try {
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch {
  try {
    firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager(undefined) })
    });
  } catch {
    firestore = getFirestore(app);
  }
}
export const db = firestore;
