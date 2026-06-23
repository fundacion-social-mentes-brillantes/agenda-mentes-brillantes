import { readFileSync } from "node:fs";
import { initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let firestore: Firestore | null = null;

function loadServiceAccount(): Record<string, unknown> | null {
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64) {
    try {
      return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    } catch (err) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 no es un JSON valido en base64.");
    }
  }

  const path = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (path) {
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      throw new Error(`No se pudo leer la llave de servicio en ${path}. Revisa la ruta del archivo.`);
    }
  }

  return null;
}

export function getDb(): Firestore {
  if (firestore) return firestore;

  let app: App;
  const serviceAccount = loadServiceAccount();

  if (serviceAccount) {
    // Opción 1: llave de servicio (JSON) por archivo o base64.
    app = initializeApp({ credential: cert(serviceAccount as any) });
  } else {
    // Opción 2: Application Default Credentials (sin descargar llave).
    // Funciona con `gcloud auth application-default login` en local,
    // con GOOGLE_APPLICATION_CREDENTIALS, o con la cuenta del entorno en la nube (Cloud Run).
    try {
      app = initializeApp({
        credential: applicationDefault(),
        projectId: process.env.AGENDA_PROJECT_ID || "calendario-5ae30"
      });
    } catch (err) {
      throw new Error(
        "Faltan las credenciales de Firebase. Usa una de estas opciones: " +
          "(a) FIREBASE_SERVICE_ACCOUNT (ruta al JSON) o FIREBASE_SERVICE_ACCOUNT_BASE64; " +
          "(b) inicia sesión con `gcloud auth application-default login`; " +
          "(c) GOOGLE_APPLICATION_CREDENTIALS."
      );
    }
  }

  firestore = getFirestore(app);
  return firestore;
}

export function getOwnerUid(): string {
  const uid = process.env.AGENDA_UID;
  if (!uid) {
    throw new Error("Falta AGENDA_UID en la configuracion (el usuario dueno de la agenda).");
  }
  return uid;
}

export function getTzOffset(): string {
  const offset = process.env.AGENDA_TZ_OFFSET || "-05:00";
  return /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : "-05:00";
}
