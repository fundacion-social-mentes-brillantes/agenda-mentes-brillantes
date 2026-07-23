// Recibe (desde la página de login) el idToken + refreshToken de Firebase del usuario
// ya autenticado con Google, valida los parámetros OAuth y devuelve la URL de retorno
// con el "code" (que lleva, cifrado, el refreshToken del usuario).

import { verifyIdToken } from "../_lib/firestore.js";
import { readClientId, mintCode } from "./_tokens.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  body = body || {};

  const { client_id, redirect_uri, code_challenge, state, idToken, refreshToken } = body;

  const client = readClientId(client_id);
  if (!client) { res.status(400).json({ error: "invalid_client" }); return; }
  if (!Array.isArray(client.ru) || !client.ru.includes(redirect_uri)) {
    res.status(400).json({ error: "invalid_redirect_uri" }); return;
  }
  if (!idToken || !refreshToken) { res.status(400).json({ error: "missing_session" }); return; }

  const user = await verifyIdToken(idToken);
  if (!user) { res.status(401).json({ error: "invalid_session", error_description: "La sesión de Google no es válida." }); return; }

  const code = mintCode({
    uid: user.localId,
    name: user.displayName || user.email || "",
    firebaseRefresh: refreshToken,
    codeChallenge: code_challenge || "",
    clientId: client_id,
    redirectUri: redirect_uri
  });

  const sep = redirect_uri.includes("?") ? "&" : "?";
  const redirect = `${redirect_uri}${sep}code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ""}`;
  res.status(200).json({ redirect });
}
