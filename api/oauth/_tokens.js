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

// Secreto para firmar/cifrar. Tiene que ser propio y exclusivo de este OAuth:
// nunca una llave que se le entregue a un tercero (antes caía a DEEPSEEK_API_KEY,
// que viaja a api.deepseek.com en cada petición del bot). Sin él, el servidor no
// emite ni acepta tokens: es preferible fallar a firmar con algo que se comparte.
const SECRET = process.env.OAUTH_SECRET || process.env.MCP_OAUTH_SECRET || "";

// De un mismo secreto salen dos llaves distintas, una para firmar y otra para
// cifrar, para no reutilizar el mismo material en dos primitivas.
function keyBytes(uso = "firma") {
  if (!SECRET) throw new Error("Falta OAUTH_SECRET en el servidor.");
  return crypto.createHash("sha256").update(`${uso}:${SECRET}`).digest();
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
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes("cifrado"), iv);
  const ct = Buffer.concat([cipher.update(String(refreshToken), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return b64url(Buffer.concat([iv, tag, ct]));
}

export function decryptRefresh(blob) {
  const raw = b64urlToBuf(blob);
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes("cifrado"), iv);
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
// El access token es un CONTENEDOR del refreshToken de Firebase (cifrado): en cada
// llamada, /api/mcp lo descifra y saca un idToken FRESCO vía securetoken. El refresh
// token de Firebase es estable y reutilizable, así que no hay razón para que el access
// token expire en 1h y obligue a una renovación OAuth (el punto que fallaba y hacía que
// el conector "perdiera autenticación"). Lo hacemos de larga duración para que funcione
// sin interrupciones día a día. El refresh_token (OAuth) dura aún más y lo extiende.
export const ACCESS_TTL_SECONDS = 60 * 60 * 24 * 90;   // 90 días
export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 365; // 365 días

export function mintAccessToken({ uid, name, firebaseRefresh, encFr }) {
  return "mcp_" + sign({ typ: "access", uid, name, fr: encFr || encryptRefresh(firebaseRefresh), exp: now() + ACCESS_TTL_SECONDS });
}
export function mintRefreshToken({ uid, name, firebaseRefresh, encFr }) {
  return "mcpr_" + sign({ typ: "refresh", uid, name, fr: encFr || encryptRefresh(firebaseRefresh), exp: now() + REFRESH_TTL_SECONDS });
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

// ---------- Direcciones de retorno permitidas ----------
// La seguridad de a donde vuelve el codigo de autorizacion la da ESTA lista, no
// la firma del client_id: el registro es abierto, asi que cualquiera podia pedir
// un client_id firmado apuntando a su propio servidor y llevarse el codigo de
// quien abriera el enlace. Con la lista, el codigo solo puede volver a Claude,
// a ChatGPT o a la maquina de uno.
// Se puede ampliar con MCP_ALLOWED_REDIRECT_HOSTS (hosts separados por coma).
const HOSTS_PERMITIDOS = [
  "claude.ai",
  "claude.com",
  "anthropic.com",
  "chatgpt.com",
  "openai.com",
  ...String(process.env.MCP_ALLOWED_REDIRECT_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
];

const esLocal = (host) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";

/** ¿Puede el codigo de autorizacion volver a esta direccion? */
export function redirectUriPermitido(uri) {
  let u;
  try {
    u = new URL(String(uri));
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  if (esLocal(host)) return u.protocol === "http:" || u.protocol === "https:";
  if (u.protocol !== "https:") return false;
  // El host debe ser uno permitido o un subdominio suyo (no basta con terminar
  // igual: "malo-claude.ai" no puede colarse como "claude.ai").
  return HOSTS_PERMITIDOS.some((permitido) => host === permitido || host.endsWith(`.${permitido}`));
}

/**
 * Lee un client_id emitido por este servidor. Verifica la firma cuando coincide;
 * si no (por ejemplo, un cliente registrado antes de rotar OAUTH_SECRET), acepta
 * el contenido igualmente. Es seguro porque quien llame DEBE validar ademas el
 * redirect_uri con redirectUriPermitido: la firma aqui solo evitaba manipular un
 * blob que cualquiera podia pedir firmado de todos modos.
 */
export function readClientIdCompatible(clientId) {
  const verificado = readClientId(clientId);
  if (verificado) return verificado;
  if (!clientId || !clientId.startsWith("mcpc_")) return null;
  try {
    const body = String(clientId).slice(5).split(".")[1];
    if (!body) return null;
    const p = JSON.parse(b64urlToBuf(body).toString("utf8"));
    return p && p.typ === "client" && Array.isArray(p.ru) ? p : null;
  } catch {
    return null;
  }
}
