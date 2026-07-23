// Endpoint MCP (Model Context Protocol) multiusuario para Agenda Mentes Brillantes.
// Transporte: Streamable HTTP (JSON-RPC por POST), sin estado. Cada llamada corre con
// la identidad del usuario (idToken de Firebase o access token OAuth -> refresh -> idToken).
// Hospedado como función serverless de Vercel, junto a la app. Sin service account.

import {
  UserFirestore,
  verifyIdToken,
  refreshIdToken
} from "./_lib/firestore.js";
import {
  listWorkspaces,
  listEvents,
  todayAgenda,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  listClients,
  addClient,
  createCoachSession
} from "./_lib/agenda.js";

const SERVER_INFO = { name: "agenda-mentes-brillantes", version: "1.0.0" };
const PROTOCOL_VERSION = "2025-06-18";
const MAX_BODY_BYTES = 200_000;

// Base pública del servicio (para las URLs de metadata OAuth). Configurable por env.
function baseUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return process.env.PUBLIC_BASE_URL || `${proto}://${host}`;
}

// ------------------------------------------------------------------
// Definición de herramientas (nombre, descripción, esquema de entrada)
// ------------------------------------------------------------------
const TOOLS = [
  {
    name: "list_workspaces",
    description: "Lista las agendas (personal y compartidas) a las que pertenece el usuario, con id, nombre, tipo y rol.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "today_agenda",
    description: "Muestra los eventos de HOY (zona horaria de Colombia). Opcional: workspace (id o nombre de la agenda).",
    inputSchema: { type: "object", properties: { workspace: { type: "string" } } }
  },
  {
    name: "list_events",
    description: "Lista eventos de una agenda. Filtros opcionales: from/to (YYYY-MM-DD), query (texto en el título), includeDone, limit, workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspace: { type: "string" },
        from: { type: "string", description: "Desde YYYY-MM-DD" },
        to: { type: "string", description: "Hasta YYYY-MM-DD" },
        query: { type: "string" },
        includeDone: { type: "boolean" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "get_event",
    description: "Devuelve el detalle de un evento por su id.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
  },
  {
    name: "create_event",
    description: "Crea un evento. Requiere title y date (YYYY-MM-DD). Si das solo startTime, dura 1 hora. Opcional: startTime/endTime (HH:MM), allDay, modality (presencial/virtual), color (#hex), reminderMinutes, totalAmount/paidAmount (COP), workspace.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" }, date: { type: "string" }, startTime: { type: "string" }, endTime: { type: "string" },
        allDay: { type: "boolean" }, modality: { type: "string", enum: ["presencial", "virtual"] }, color: { type: "string" },
        reminderMinutes: { type: "number" }, totalAmount: { type: "number" }, paidAmount: { type: "number" }, workspace: { type: "string" }
      },
      required: ["title", "date"]
    }
  },
  {
    name: "update_event",
    description: "Edita un evento existente por id. Envía solo los campos a cambiar. done=true lo marca como hecho.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }, title: { type: "string" }, date: { type: "string" }, startTime: { type: "string" }, endTime: { type: "string" },
        allDay: { type: "boolean" }, modality: { type: "string", enum: ["presencial", "virtual"] }, color: { type: "string" },
        reminderMinutes: { type: "number" }, totalAmount: { type: "number" }, paidAmount: { type: "number" }, done: { type: "boolean" }
      },
      required: ["id"]
    }
  },
  {
    name: "delete_event",
    description: "Elimina un evento por id. Irreversible.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
  },
  {
    name: "list_clients",
    description: "Lista las personas de sesiones coach (nombre y código). Opcional: workspace.",
    inputSchema: { type: "object", properties: { workspace: { type: "string" } } }
  },
  {
    name: "add_client",
    description: "Crea una persona nueva para sesiones coach; se le asigna el siguiente código consecutivo. Requiere name.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, workspace: { type: "string" } }, required: ["name"] }
  },
  {
    name: "create_coach_session",
    description: "Agenda una SESIÓN COACH con una persona (por clientCode o clientName). Virtual por defecto. Requiere date (YYYY-MM-DD).",
    inputSchema: {
      type: "object",
      properties: {
        clientCode: { type: "number" }, clientName: { type: "string" }, date: { type: "string" },
        startTime: { type: "string" }, endTime: { type: "string" }, allDay: { type: "boolean" },
        modality: { type: "string", enum: ["presencial", "virtual"] }, totalAmount: { type: "number" }, paidAmount: { type: "number" }, workspace: { type: "string" }
      },
      required: ["date"]
    }
  }
];

// ------------------------------------------------------------------
// Sesión del usuario a partir del Bearer (idToken directo u OAuth access token)
// ------------------------------------------------------------------
async function resolveSession(bearer) {
  if (!bearer) return null;

  // 1) ¿Es un access token OAuth nuestro? (guardado en Firestore por el flujo OAuth)
  //    Se resuelve con la clave admin-less: buscamos en la colección mcp_tokens con el
  //    idToken del propio dueño... pero como no hay admin, el flujo OAuth guardará el
  //    refreshToken cifrado y este endpoint lo canjeará. (Se completa al montar OAuth.)
  if (bearer.startsWith("mcp_")) {
    const session = await resolveOAuthToken(bearer);
    if (!session) return null;
    const refreshed = await refreshIdToken(session.firebaseRefreshToken);
    return { fs: new UserFirestore(refreshed.idToken), uid: refreshed.uid || session.uid, name: session.name || "" };
  }

  // 2) Si no, tratamos el Bearer como un idToken de Firebase (modo directo / pruebas).
  const user = await verifyIdToken(bearer);
  if (!user) return null;
  return { fs: new UserFirestore(bearer), uid: user.localId, name: user.displayName || user.email || "" };
}

// Placeholder: lo implementa el módulo OAuth (api/oauth/*). Por ahora null.
async function resolveOAuthToken(_accessToken) {
  try {
    const mod = await import("./oauth/_store.js");
    return mod.getAccessToken ? mod.getAccessToken(_accessToken) : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// Ejecutor de herramientas
// ------------------------------------------------------------------
async function runTool(session, name, args = {}) {
  const { fs, uid, name: userName } = session;
  switch (name) {
    case "list_workspaces":
      return listWorkspaces(fs, uid);
    case "today_agenda":
      return todayAgenda(fs, uid, args.workspace);
    case "list_events":
      return listEvents(fs, uid, args);
    case "get_event":
      return getEvent(fs, uid, args.id);
    case "create_event":
      return createEvent(fs, uid, args, userName);
    case "update_event": {
      const { id, ...patch } = args;
      return updateEvent(fs, uid, id, patch);
    }
    case "delete_event":
      await deleteEvent(fs, args.id);
      return { deleted: true, id: args.id };
    case "list_clients":
      return listClients(fs, uid, args.workspace);
    case "add_client":
      return addClient(fs, uid, args.workspace, args.name);
    case "create_coach_session":
      return createCoachSession(fs, uid, args, userName);
    default:
      throw new Error(`Herramienta desconocida: ${name}`);
  }
}

// ------------------------------------------------------------------
// Handler HTTP (JSON-RPC)
// ------------------------------------------------------------------
function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export default async function handler(req, res) {
  // CORS (Claude/ChatGPT llaman desde el navegador/servidor de su lado)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, WWW-Authenticate");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    // No hay streaming SSE en modo sin estado.
    res.status(405).json({ error: "Use POST para JSON-RPC." });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json(rpcError(null, -32600, "Método HTTP no permitido."));
    return;
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    res.status(413).json(rpcError(null, -32600, "Solicitud demasiado grande."));
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch { res.status(400).json(rpcError(null, -32700, "JSON inválido.")); return; }
  }
  if (!body || typeof body !== "object") { res.status(400).json(rpcError(null, -32700, "Cuerpo inválido.")); return; }

  const { id, method, params } = body;

  // Métodos que NO requieren autenticación
  if (method === "initialize") {
    res.status(200).json(rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: "Agenda del Gimnasio Emocional Mentes Brillantes. Herramientas para ver y gestionar eventos y sesiones coach."
    }));
    return;
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    res.status(202).end();
    return;
  }
  if (method === "ping") {
    res.status(200).json(rpcResult(id, {}));
    return;
  }
  if (method === "tools/list") {
    res.status(200).json(rpcResult(id, { tools: TOOLS }));
    return;
  }

  if (method === "tools/call") {
    // Requiere autenticación
    const auth = req.headers.authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    let session;
    try {
      session = await resolveSession(bearer);
    } catch {
      session = null;
    }
    if (!session) {
      res.setHeader(
        "WWW-Authenticate",
        `Bearer resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource"`
      );
      res.status(401).json(rpcError(id, -32001, "No autenticado. Conecta tu cuenta."));
      return;
    }

    const toolName = params?.name;
    const args = params?.arguments || {};
    try {
      const data = await runTool(session, toolName, args);
      res.status(200).json(rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      }));
    } catch (err) {
      // Errores de herramienta se devuelven como resultado isError (no como error JSON-RPC),
      // para que el modelo los vea y reaccione.
      res.status(200).json(rpcResult(id, {
        content: [{ type: "text", text: `Error: ${err?.message || "no se pudo completar la acción."}` }],
        isError: true
      }));
    }
    return;
  }

  res.status(200).json(rpcError(id, -32601, `Método no soportado: ${method}`));
}
