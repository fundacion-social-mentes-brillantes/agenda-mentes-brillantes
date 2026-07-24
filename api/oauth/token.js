// Endpoint de token OAuth 2.1. Cambia el "code" por access/refresh tokens (con PKCE),
// y renueva con grant_type=refresh_token. Sin estado (los tokens son autocontenidos).

import { readCode, readRefreshToken, mintAccessToken, mintRefreshToken, verifyPkce, ACCESS_TTL_SECONDS } from "./_tokens.js";

function parseBody(req) {
  let body = req.body;
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) return body;
  const raw = typeof body === "string" ? body : "";
  const ct = String(req.headers["content-type"] || "");
  if (ct.includes("application/json")) {
    try { return JSON.parse(raw || "{}"); } catch { return {}; }
  }
  // x-www-form-urlencoded
  const out = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "invalid_request" }); return; }

  const body = parseBody(req);
  const grantType = body.grant_type;

  if (grantType === "authorization_code") {
    const p = readCode(body.code);
    if (!p) { res.status(400).json({ error: "invalid_grant", error_description: "Código inválido o vencido." }); return; }
    if (p.ru && body.redirect_uri && p.ru !== body.redirect_uri) {
      res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri no coincide." }); return;
    }
    if (!verifyPkce(body.code_verifier, p.cc)) {
      res.status(400).json({ error: "invalid_grant", error_description: "PKCE inválido." }); return;
    }
    const access = mintAccessToken({ uid: p.uid, name: p.name, encFr: p.fr });
    const refresh = mintRefreshToken({ uid: p.uid, name: p.name, encFr: p.fr });
    res.status(200).json({ access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_SECONDS, refresh_token: refresh, scope: "agenda" });
    return;
  }

  if (grantType === "refresh_token") {
    const p = readRefreshToken(body.refresh_token);
    if (!p) { res.status(400).json({ error: "invalid_grant", error_description: "refresh_token inválido." }); return; }
    const access = mintAccessToken({ uid: p.uid, name: p.name, encFr: p.fr });
    const refresh = mintRefreshToken({ uid: p.uid, name: p.name, encFr: p.fr });
    res.status(200).json({ access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_SECONDS, refresh_token: refresh, scope: "agenda" });
    return;
  }

  res.status(400).json({ error: "unsupported_grant_type" });
}
