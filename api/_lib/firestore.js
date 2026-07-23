// Capa Firestore MULTIUSUARIO por REST, SIN service account (no firebase-admin).
// Cada operación corre con el idToken de Firebase del usuario que llama, así las
// reglas de seguridad (firestore.rules) autorizan igual que en el navegador.
// Reutiliza el patrón probado en api/assistant.js y lo extiende con ESCRITURAS.
//
// Se usa tanto por el endpoint del MCP (api/mcp.js) como por el flujo OAuth.

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  "AIzaSyAfijrkvPKyIgnyfkYEJvjmYqT77disxHI"; // clave web pública (no es secreto)
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  "calendario-5ae30";

const IDENTITY_BASE = "https://identitytoolkit.googleapis.com/v1";
const SECURETOKEN_BASE = "https://securetoken.googleapis.com/v1";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export const firebaseConfig = { apiKey: FIREBASE_API_KEY, projectId: FIREBASE_PROJECT_ID };

// ------------------------------------------------------------------
// Autenticación / tokens (todo con la clave web pública, sin admin SDK)
// ------------------------------------------------------------------

/** Valida un idToken de Firebase y devuelve el usuario {localId, email, displayName} o null. */
export async function verifyIdToken(idToken) {
  if (!idToken) return null;
  try {
    const r = await fetch(`${IDENTITY_BASE}/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.users && data.users[0] ? data.users[0] : null;
  } catch {
    return null;
  }
}

/** Refresca un idToken caducado a partir del refreshToken. Devuelve {idToken, refreshToken, expiresIn}. */
export async function refreshIdToken(refreshToken) {
  const r = await fetch(`${SECURETOKEN_BASE}/token?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken })
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`No se pudo refrescar el token de sesión. ${detail.slice(0, 200)}`);
  }
  const data = await r.json();
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: Number(data.expires_in) || 3600,
    uid: data.user_id
  };
}

/**
 * Intercambia una credencial de Google (id_token/access_token de OAuth de Google)
 * por una sesión de Firebase del MISMO proyecto: devuelve idToken + refreshToken + uid.
 * Es el puente OAuth-Google -> Firebase, sin service account.
 */
export async function signInWithGoogle({ googleIdToken, googleAccessToken, requestUri }) {
  const postBody = new URLSearchParams();
  if (googleIdToken) postBody.set("id_token", googleIdToken);
  if (googleAccessToken) postBody.set("access_token", googleAccessToken);
  postBody.set("providerId", "google.com");
  const r = await fetch(`${IDENTITY_BASE}/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postBody: postBody.toString(),
      requestUri: requestUri || "http://localhost",
      returnIdpCredential: true,
      returnSecureToken: true
    })
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`No se pudo iniciar sesión con Google en Firebase. ${detail.slice(0, 200)}`);
  }
  const data = await r.json();
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    uid: data.localId,
    email: data.email,
    displayName: data.displayName || data.fullName || "",
    photoUrl: data.photoUrl || ""
  };
}

// ------------------------------------------------------------------
// Codificación / decodificación del formato tipado de Firestore REST
// ------------------------------------------------------------------

/** Firestore value -> valor JS plano. */
export function decodeValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("timestampValue" in value) return value.timestampValue; // ISO string
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decodeValue(v)])
    );
  }
  return null;
}

/** Documento REST -> { id, data } */
export function decodeDoc(document) {
  const fields = document?.fields || {};
  const data = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
  return { id: String(document?.name || "").split("/").pop() || "", data, name: document?.name || "" };
}

/** Marcador para escribir un timestamp (fecha JS o ISO string). */
export class Ts {
  constructor(date) {
    this.iso = (date instanceof Date ? date : new Date(date)).toISOString();
  }
}

/** valor JS -> Firestore value tipado. */
export function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Ts) return { timestampValue: v.iso };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === "object") {
    return { mapValue: { fields: encodeFields(v) } };
  }
  return { nullValue: null };
}

/** objeto JS -> { fieldName: firestoreValue } */
export function encodeFields(obj) {
  const out = {};
  for (const [k, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    out[k] = encodeValue(val);
  }
  return out;
}

// ------------------------------------------------------------------
// Cliente Firestore ligado a UN usuario (su idToken)
// ------------------------------------------------------------------

export class UserFirestore {
  constructor(idToken) {
    this.idToken = idToken;
  }

  async _fetch(pathAndQuery, init = {}) {
    const res = await fetch(`${FIRESTORE_BASE}/${pathAndQuery}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.idToken}`,
        ...(init.headers || {})
      }
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const err = new Error(`Firestore ${res.status}: ${detail.slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    // DELETE devuelve cuerpo vacío
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }

  /** Lee un documento por ruta relativa (ej. "events/abc"). Devuelve {id,data} o null si no existe. */
  async getDoc(path) {
    try {
      const doc = await this._fetch(encodeURI(path));
      return decodeDoc(doc);
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  /** Consulta estructurada (runQuery, cuelga de .../documents:runQuery). Devuelve array de {id,data}. */
  async runQuery(structuredQuery) {
    const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.idToken}` },
      body: JSON.stringify({ structuredQuery })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const err = new Error(`Firestore runQuery ${res.status}: ${detail.slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    const arr = await res.json();
    return (Array.isArray(arr) ? arr : []).filter((r) => r.document).map((r) => decodeDoc(r.document));
  }

  /** Crea un documento (id automático o el dado). data = objeto JS plano. Devuelve {id,data}. */
  async createDoc(collectionId, data, docId) {
    const q = docId ? `${collectionId}?documentId=${encodeURIComponent(docId)}` : collectionId;
    const doc = await this._fetch(q, { method: "POST", body: JSON.stringify({ fields: encodeFields(data) }) });
    return decodeDoc(doc);
  }

  /** Actualiza (parcial) los campos dados de un documento existente. */
  async patchDoc(path, data) {
    const fieldPaths = Object.keys(data).filter((k) => data[k] !== undefined);
    const mask = fieldPaths.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
    const doc = await this._fetch(`${encodeURI(path)}?${mask}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: encodeFields(data) })
    });
    return decodeDoc(doc);
  }

  /** Borra un documento por ruta. */
  async deleteDoc(path) {
    await this._fetch(encodeURI(path), { method: "DELETE" });
  }
}

export { FIREBASE_PROJECT_ID, FIREBASE_API_KEY };
