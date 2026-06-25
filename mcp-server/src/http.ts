import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import express from "express";
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./tools.js";

const PORT = Number(process.env.MCP_HTTP_PORT || 8787);
const TOKEN = process.env.MCP_BEARER_TOKEN || "";
const MIN_TOKEN_LENGTH = 32;

if (!TOKEN) {
  console.error("Falta MCP_BEARER_TOKEN. Define un token secreto para proteger el servidor en la nube.");
  process.exit(1);
}
if (TOKEN.length < MIN_TOKEN_LENGTH) {
  console.error(`MCP_BEARER_TOKEN debe tener al menos ${MIN_TOKEN_LENGTH} caracteres.`);
  process.exit(1);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function authorized(req: Request): boolean {
  const header = req.headers["authorization"] || "";
  const match = /^Bearer\s+(.+)$/i.exec(Array.isArray(header) ? header[0] : header);
  return !!match && safeEqual(match[1], TOKEN);
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "agenda-mentes-brillantes-mcp" });
});

app.post("/mcp", async (req: Request, res: Response) => {
  if (!authorized(req)) {
    res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "No autorizado." }, id: null });
    return;
  }

  // Modo sin estado: un servidor y transporte nuevos por solicitud.
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error manejando solicitud MCP:", err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Error interno." }, id: null });
    }
  }
});

// En modo sin estado no se admiten GET/DELETE de sesión.
const methodNotAllowed = (_req: Request, res: Response) => {
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Método no permitido." }, id: null });
};
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.listen(PORT, () => {
  console.error(`Agenda Mentes Brillantes MCP (HTTP) escuchando en el puerto ${PORT}.`);
});
