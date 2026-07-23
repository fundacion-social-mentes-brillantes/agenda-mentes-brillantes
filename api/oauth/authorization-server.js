// Metadata del servidor de autorización OAuth 2.1 del MCP.
// Se sirve en /.well-known/oauth-authorization-server (via rewrite en vercel.json).

function baseUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return process.env.PUBLIC_BASE_URL || `${proto}://${host}`;
}

export default function handler(req, res) {
  const base = baseUrl(req);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["agenda"]
  });
}
