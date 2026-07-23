// Registro dinámico de cliente (DCR) SIN estado: el client_id es un blob firmado
// con los redirect_uris. Claude y ChatGPT registran su cliente aquí automáticamente.

import { mintClientId } from "./_tokens.js";

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  body = body || {};

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u) => typeof u === "string") : [];
  if (redirectUris.length === 0) {
    res.status(400).json({ error: "invalid_redirect_uri", error_description: "Faltan redirect_uris." });
    return;
  }

  const clientId = mintClientId(redirectUris);
  res.status(201).json({
    client_id: clientId,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: typeof body.client_name === "string" ? body.client_name : "MCP Client"
  });
}
