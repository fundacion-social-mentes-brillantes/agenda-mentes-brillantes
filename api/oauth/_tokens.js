// Tokens firmados para el OAuth del MCP — SIN base de datos (stateless).
// Todo se firma/cifra con OAUTH_SECRET (env). Dentro del token viaja, cifrado,
// el refreshToken de Firebase del usuario, para poder actuar como él sin admin.
//
// Piezas:
//  - client_id: blob firmado con los redirect_uris registrados (DCR sin estado).
//  - code (autorización): blob firmado con el refresh cifrado + PKCE + cliente.
//  - access token ("mcp_..."): JWT corto con el refresh cifrado.
//  - refresh token: JWT largo con el refresh cifrado.

import crypto from "node:crypto";

// Secreto para firmar/cifrar. Si no hay uno dedicado (OAUTH_SECRET), reutiliza un
// secreto de servidor que ya existe en Vercel (DEEPSEEK_API_KEY) para funcionar sin
// pasos manuales. Recomendado: definir OAUTH_SECRET propio cuando se pueda.
const SECRET =
  process.env.OAUTH_SECRET ||
  process.env.MCP_OAUTH_SECRET ||
  process.env.DEEPSEEK_API_KEY ||
  "";

function keyBytes() {
  if (!SECRET) throw new Error("Falta OAUTH_SECRET en el servidor.");
  return crypto.createHash("sha256").update(SECRET).digest();
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBuf(str) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function b64urlJson(obj) {
  return b64url(Buffer.from(JSON.stringify(obj), "utf8"));
}

// ---------- Firma tipo JWT (HS256) ----------
export function sign(payload) {
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const body = b64urlJson(payload);
  const data = `${header}.${body}`;
  const sig = b64url(crypto.createHmac("sha256", keyBytes()).update(data).digest());
  return `${data}.${sig}`;
}

export function verify(token) {
  try {
    const [header, body, sig] = String(token).split(".");
    if (!header || !body || !sig) return null;
    const expected = b64url(crypto.createHmac("sha256", keyBytes()).update(`${header}.${body}`).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(b64urlToBuf(body).toString("utf8"));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Cifrado del refreshToken de Firebase (AES-256-GCM) ----------
export function encryptRefresh(refreshToken) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(), iv);
  const ct = Buffer.concat([cipher.update(String(refreshToken), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return b64url(Buffer.concat([iv, tag, ct]));
}

export function decryptRefresh(blob) {
  const raw = b64urlToBuf(blob);
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

const now = () => Math.floor(Date.now() / 1000);

// ---------- client_id (DCR sin estado) ----------
export function mintClientId(redirectUris) {
  return "mcpc_" + sign({ typ: "client", ru: redirectUris, iat: now() });
}
export function readClientId(clientId) {
  if (!clientId || !clientId.startsWith("mcpc_")) return null;
  const p = verify(clientId.slice(5));
  return p && p.typ === "client" ? p : null;
}

// ---------- código de autorización ----------
export function mintCode({ uid, name, firebaseRefresh, codeChallenge, clientId, redirectUri }) {
  return "mcpa_" + sign({
    typ: "code",
    uid, name,
    fr: encryptRefresh(firebaseRefresh),
    cc: codeChallenge || "",
    cid: clientId || "",
    ru: redirectUri || "",
    exp: now() + 600 // 10 min
  });
}
export function readCode(code) {
  if (!code || !code.startsWith("mcpa_")) return null;
  const p = verify(code.slice(5));
  return p && p.typ === "code" ? p : null;
}

// ---------- access / refresh tokens ----------
export function mintAccessToken({ uid, name, firebaseRefresh, encFr }) {
  return "mcp_" + sign({ typ: "access", uid, name, fr: encFr || encryptRefresh(firebaseRefresh), exp: now() + 3600 });
}
export function mintRefreshToken({ uid, name, firebaseRefresh, encFr }) {
  return "mcpr_" + sign({ typ: "refresh", uid, name, fr: encFr || encryptRefresh(firebaseRefresh), exp: now() + 60 * 60 * 24 * 60 }); // 60 días
}

/** Lee un access token del MCP -> { uid, name, firebaseRefreshToken } o null. */
export function readAccessToken(bearer) {
  if (!bearer || !bearer.startsWith("mcp_")) return null;
  const p = verify(bearer.slice(4));
  if (!p || p.typ !== "access") return null;
  try {
    return { uid: p.uid, name: p.name || "", firebaseRefreshToken: decryptRefresh(p.fr) };
  } catch {
    return null;
  }
}

/** Lee un refresh token del MCP -> payload o null. */
export function readRefreshToken(token) {
  if (!token || !token.startsWith("mcpr_")) return null;
  const p = verify(token.slice(5));
  return p && p.typ === "refresh" ? p : null;
}

// ---------- PKCE ----------
export function verifyPkce(codeVerifier, codeChallenge) {
  if (!codeChallenge) return true; // sin PKCE (algunos clientes)
  if (!codeVerifier) return false;
  const hash = b64url(crypto.createHash("sha256").update(codeVerifier).digest());
  return hash === codeChallenge;
}

export function hasSecret() {
  return Boolean(SECRET);
}
