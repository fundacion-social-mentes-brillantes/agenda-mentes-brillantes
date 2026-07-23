// Metadata del "recurso protegido" (el MCP). MCP clients la descubren tras el 401.
// Se sirve en /.well-known/oauth-protected-resource (via rewrite en vercel.json).

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
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    scopes_supported: ["agenda"],
    bearer_methods_supported: ["header"]
  });
}
