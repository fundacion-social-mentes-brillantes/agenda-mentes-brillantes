// Función de servidor (Vercel) para el asistente con DeepSeek (con herramientas / function-calling).
// La clave de DeepSeek vive aquí (DEEPSEEK_API_KEY), NUNCA en el navegador.
// Las herramientas (crear/editar/eliminar) las EJECUTA el navegador en la sesión del usuario,
// bajo las reglas de Firebase. El servidor solo conversa con DeepSeek y relé el mensaje.

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  "AIzaSyAfijrkvPKyIgnyfkYEJvjmYqT77disxHI"; // clave web publica
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  "calendario-5ae30";

const MAX_BODY_BYTES = 120_000;
const MAX_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 2_000;
const MAX_TOOL_ARG_CHARS = 4_000;
const MAX_EVENTS = 800;
const MAX_CLIENTS = 1000;
const ALLOWED_MESSAGE_ROLES = new Set(["user", "assistant", "tool"]);
const ALLOWED_TOOL_NAMES = new Set([
  "create_event",
  "update_event",
  "duplicate_event",
  "create_coach_session",
  "add_client",
  "delete_event"
]);

async function verifyUser(idToken) {
  if (!idToken) return null;
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
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

function trimText(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseBody(body) {
  if (typeof body !== "string") return body && typeof body === "object" ? body : {};
  try {
    return JSON.parse(body || "{}");
  } catch {
    return null;
  }
}

function firestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(firestoreValue);
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, firestoreValue(child)])
    );
  }
  return null;
}

function firestoreDoc(document) {
  const fields = document?.fields || {};
  const data = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, firestoreValue(value)]));
  return {
    id: String(document?.name || "").split("/").pop() || "",
    data
  };
}

function bogotaDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function bogotaTime(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function bogotaDateTime(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function todayInBogota() {
  return new Date().toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

async function firestoreFetch(idToken, pathOrSuffix, init = {}) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/${pathOrSuffix}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error("No se pudo verificar la agenda con Firebase.");
  }
  return response.json();
}

async function loadWorkspaceContext(idToken, workspaceId) {
  const safeWorkspaceId = trimText(workspaceId, 160);
  if (!safeWorkspaceId || safeWorkspaceId.includes("/")) {
    throw new Error("Agenda no valida.");
  }

  const workspacePromise = firestoreFetch(idToken, `documents/workspaces/${encodeURIComponent(safeWorkspaceId)}`);
  const eventsPromise = firestoreFetch(idToken, "documents:runQuery", {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "events" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "workspaceId" },
            op: "EQUAL",
            value: { stringValue: safeWorkspaceId }
          }
        },
        limit: MAX_EVENTS + MAX_CLIENTS
      }
    })
  });

  const [workspaceRaw, queryRows] = await Promise.all([workspacePromise, eventsPromise]);
  const workspace = firestoreDoc(workspaceRaw).data;
  const docs = (Array.isArray(queryRows) ? queryRows : [])
    .map((row) => (row.document ? firestoreDoc(row.document) : null))
    .filter(Boolean);

  const eventDocs = docs.filter(({ data }) => data.recordType !== "client").slice(0, MAX_EVENTS);
  const clientDocs = docs.filter(({ data }) => data.recordType === "client").slice(0, MAX_CLIENTS);

  const counts = new Map();
  const nowMs = Date.now();
  for (const { data } of eventDocs) {
    if (data.kind === "coach" && typeof data.clientCode === "number") {
      const current = counts.get(data.clientCode) || { tomadas: 0, proximas: 0 };
      const startMs = new Date(data.startAt || "").getTime();
      if (Number.isFinite(startMs) && startMs < nowMs) current.tomadas++;
      else current.proximas++;
      counts.set(data.clientCode, current);
    }
  }

  const events = eventDocs.map(({ id, data }) => {
    const item = {
      id,
      t: trimText(data.title, 160),
      f: bogotaDate(data.startAt),
      h: data.allDay ? "todo el dia" : bogotaTime(data.startAt),
      m: data.modality === "virtual" || data.modality === "presencial" ? data.modality : "otro",
      creado: bogotaDateTime(data.createdAt)
    };
    if (data.kind === "coach") {
      item.coach = true;
      if (data.clientName) item.cn = trimText(data.clientName, 160);
      if (typeof data.clientCode === "number") item.cc = data.clientCode;
    }
    if (typeof data.totalAmount === "number") item.vt = data.totalAmount;
    if (typeof data.paidAmount === "number") item.va = data.paidAmount;
    if (data.meetingUrl) item.link = trimText(data.meetingUrl, 300);
    return item;
  });

  const clients = clientDocs.map(({ data }) => {
    const code = typeof data.clientCode === "number" ? data.clientCode : Number(data.clientCode) || 0;
    const k = counts.get(code) || { tomadas: 0, proximas: 0 };
    return {
      code,
      name: trimText(data.clientName, 160),
      tomadas: k.tomadas,
      proximas: k.proximas,
      total: k.tomadas + k.proximas
    };
  });

  return {
    workspaceName: trimText(workspace.name, 120) || "Tu agenda",
    events,
    clients
  };
}

function sanitizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return undefined;
  const cleaned = toolCalls
    .slice(0, 8)
    .map((call) => {
      const name = trimText(call?.function?.name, 80);
      if (!ALLOWED_TOOL_NAMES.has(name)) return null;
      return {
        id: trimText(call?.id, 120),
        type: "function",
        function: {
          name,
          arguments: trimText(call?.function?.arguments, MAX_TOOL_ARG_CHARS)
        }
      };
    })
    .filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && typeof m === "object" && ALLOWED_MESSAGE_ROLES.has(m.role))
    .slice(-MAX_MESSAGES)
    .map((m) => {
      const msg = { role: m.role };
      if (typeof m.content === "string") msg.content = m.content.slice(0, MAX_MESSAGE_CHARS);
      if (m.role === "assistant") {
        const toolCalls = sanitizeToolCalls(m.tool_calls);
        if (toolCalls) msg.tool_calls = toolCalls;
      }
      if (m.role === "tool") msg.tool_call_id = trimText(m.tool_call_id, 120);
      if (msg.content === undefined && !msg.tool_calls) msg.content = "";
      return msg;
    });
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_event",
      description: "Crea un evento nuevo en la agenda activa del usuario.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título del evento." },
          date: { type: "string", description: "Fecha YYYY-MM-DD (calcula fechas relativas a partir de HOY)." },
          startTime: { type: "string", description: "Hora inicio HH:MM (24h)." },
          endTime: { type: "string", description: "Hora fin HH:MM (24h)." },
          allDay: { type: "boolean", description: "Evento de todo el día." },
          modality: { type: "string", enum: ["presencial", "virtual", "otro"] },
          color: { type: "string", description: "Color hex, ej #3b82f6." },
          reminderMinutes: { type: "number", description: "Minutos de recordatorio antes (0,10,30,60,1440)." },
          totalAmount: { type: "number", description: "Valor total en pesos." },
          paidAmount: { type: "number", description: "Valor abonado en pesos." }
        },
        required: ["title", "date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_event",
      description: "Edita un evento existente identificado por su id (usa el id de la lista de eventos). Solo envía los campos que cambian.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          date: { type: "string", description: "Nueva fecha YYYY-MM-DD." },
          startTime: { type: "string" },
          endTime: { type: "string" },
          allDay: { type: "boolean" },
          modality: { type: "string", enum: ["presencial", "virtual", "otro"] },
          color: { type: "string" },
          reminderMinutes: { type: "number" },
          totalAmount: { type: "number" },
          paidAmount: { type: "number" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "duplicate_event",
      description: "Duplica (copia) un evento existente a otra fecha y/u hora. Usa el id del evento original. Si no se da fecha nueva, copia en el mismo día.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "id del evento a copiar." },
          date: { type: "string", description: "Fecha destino YYYY-MM-DD." },
          startTime: { type: "string", description: "Hora inicio HH:MM (opcional, si no se mantiene la del original)." },
          endTime: { type: "string" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_coach_session",
      description:
        "Crea una SESIÓN COACH para una persona de la base de datos. Identifica la persona por clientCode (preferido) o por clientName (nombre exacto o parecido de la lista PERSONAS). El título se pone con el nombre de la persona.",
      parameters: {
        type: "object",
        properties: {
          clientCode: { type: "number", description: "Código de la persona (de la lista PERSONAS)." },
          clientName: { type: "string", description: "Nombre de la persona, si no tienes el código." },
          date: { type: "string", description: "Fecha YYYY-MM-DD." },
          startTime: { type: "string", description: "Hora inicio HH:MM (24h). Si solo das inicio, dura 1 hora." },
          endTime: { type: "string", description: "Hora fin HH:MM (24h), opcional." },
          allDay: { type: "boolean" },
          modality: { type: "string", enum: ["presencial", "virtual"], description: "Por defecto virtual; presencial solo si el usuario lo pide." },
          totalAmount: { type: "number" },
          paidAmount: { type: "number" }
        },
        required: ["date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_client",
      description:
        "Crea una PERSONA nueva en la base de datos de sesiones coach. Se le asigna automáticamente el siguiente código consecutivo. Úsalo solo si la persona no existe ya en la lista PERSONAS.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre completo de la persona." }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_event",
      description: "Elimina un evento por su id. El navegador pedirá confirmación al usuario antes de borrar.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string", description: "Título del evento (para mostrarlo en la confirmación)." }
        },
        required: ["id"]
      }
    }
  }
];

function buildSystem({ workspaceName, userName, today, events, clients }) {
  return [
    `Eres el asistente personal de la agenda "${workspaceName}" de ${userName || "el usuario"} (Gimnasio Emocional Mentes Brillantes).`,
    `Hoy es ${today}. Zona horaria de Colombia (UTC-5). Hablas español, eres cálido, claro y muy preciso.`,
    `Eres "uno con la agenda": CONSULTAS y también ACTÚAS con tus herramientas: crear evento normal (create_event), crear SESIÓN COACH (create_coach_session), crear persona (add_client), mover (update_event), duplicar (duplicate_event) y eliminar.`,
    ``,
    `Reglas (síguelas al pie de la letra):`,
    `- SÉ AUTOSUFICIENTE Y DECIDIDO: si la intención está clara, ACTÚA de una con la herramienta; NO pidas permiso ni propongas opciones. La única excepción es ELIMINAR (el navegador pedirá confirmación solo).`,
    `- SESIONES COACH: cuando el pedido es sobre una sesión con una PERSONA (ej. "agenda sesión con Catalina", "sesión coach de Jorge el lunes"), usa create_coach_session e identifica a la persona por su código de la lista PERSONAS (o por nombre). Si la persona NO está en la lista, primero créala con add_client y luego agenda. Las sesiones coach son VIRTUALES por defecto; usa presencial solo si el usuario lo dice.`,
    `- ENLACES FIJOS: "Sala de reducción del ego" virtual usa https://meet.google.com/pgk-svvh-brp; "Entrega de pasos" virtual usa https://meet.google.com/zrt-matj-dwe; toda sesión coach virtual usa https://meet.google.com/ouz-vnmr-fma. La app los asigna automáticamente y nunca debes proponer cambiarlos.`,
    `- "Duplicar/copiar X" → duplicate_event. "Mover/pasar/cambiar X" → update_event. "Agenda una reunión/recordatorio" (sin persona) → create_event.`,
    `- Si piden a varias fechas ("los próximos 3 martes", "toda la semana"), haz VARIAS llamadas, una por fecha.`,
    `- Fechas relativas ("mañana", "el próximo martes", "en 2 semanas", "fin de mes") → calcula la fecha real desde HOY.`,
    `- HORAS exactamente según lo que pida el usuario: si da inicio Y fin, usa ambas; si da SOLO la hora de inicio (ej. "a las 4"), NO inventes la hora de fin (déjala vacía: la app la pone 1 hora después, 4→5); si dice "todo el día", allDay=true; si no menciona hora, usa 09:00 (la app la deja de 1 hora). Al duplicar/mover sin hora nueva, conserva la del evento original.`,
    `- Usa el "id" exacto de la lista para mover/duplicar/borrar. Si hay varias coincidencias reales y no puedes elegir, SOLO ahí pregunta (corto).`,
    `- Si acabas de crear algo y en el mismo pedido debes moverlo/duplicarlo, usa el id que devuelve la herramienta (texto "id=...").`,
    `- Para CONTAR sesiones de una persona ("cuántas lleva", "cuántas ha tomado", "cuántas próximas"): USA LOS NÚMEROS YA CALCULADOS en PERSONAS (campos tomadas, proximas, total). NO los recalcules contando eventos por título; los eventos normales con un nombre parecido NO cuentan. Responde con esos números tal cual (coinciden con el panel de Sesiones coach).`,
    ``,
    `- NUNCA muestres al usuario los identificadores internos (id) de los eventos ni de las personas; son solo para tus herramientas. Refiérete a los eventos por su título, fecha y hora.`,
    `ESTILO: MUY CONCISO. Responde en 1–2 frases. Tras actuar, confirma en una sola línea (ej. "Listo, agendé la sesión de Catalina el jueves 25 a las 3 pm."). Amplía o usa viñetas SOLO si te piden detalle o si listas varios resultados.`,
    ``,
    `Cada evento tiene: id, t=título, f=fecha (YYYY-MM-DD), h=hora, m=modalidad, coach=true si es sesión coach, cn=nombre de la persona, cc=código de la persona, vt=valor total, va=valor abonado, link=enlace de reunión, creado=fecha/hora de registro.`,
    `Cada persona (PERSONAS) tiene: code=código, name=nombre, y sus sesiones coach YA CONTADAS: tomadas (pasadas), proximas (futuras), total.`,
    ``,
    `PERSONAS (${clients.length}):`,
    JSON.stringify(clients),
    ``,
    `EVENTOS (${events.length}):`,
    JSON.stringify(events)
  ].join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    res.status(413).json({ error: "La solicitud es demasiado grande." });
    return;
  }

  const body = parseBody(req.body);
  if (!body) {
    res.status(400).json({ error: "El cuerpo de la solicitud no es JSON valido." });
    return;
  }
  const { idToken, messages = [], workspaceId = "" } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Faltan los mensajes de la conversación." });
    return;
  }

  if (!trimText(workspaceId, 160)) {
    res.status(400).json({ error: "Falta la agenda activa." });
    return;
  }

  const user = await verifyUser(idToken);
  if (!user) {
    res.status(401).json({ error: "Tu sesión no es válida. Cierra y vuelve a iniciar sesión." });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Falta configurar DEEPSEEK_API_KEY en Vercel (variables de entorno)." });
    return;
  }

  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  let context;
  try {
    context = await loadWorkspaceContext(idToken, workspaceId);
  } catch {
    res.status(403).json({ error: "No pudimos verificar que tengas acceso a esta agenda." });
    return;
  }

  const system = buildSystem({
    workspaceName: context.workspaceName,
    userName: trimText(user.displayName || user.email || "", 120),
    today: todayInBogota(),
    events: context.events,
    clients: context.clients
  });

  // Mensajes válidos para la API (sin system; lo agregamos nosotros).
  const convo = sanitizeMessages(messages);

  try {
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...convo],
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.2,
        stream: false
      })
    });

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      res.status(502).json({ error: "El asistente no pudo responder en este momento.", detail });
      return;
    }

    const data = await r.json();
    const message = data?.choices?.[0]?.message || { role: "assistant", content: "No pude generar una respuesta." };
    res.status(200).json({ message });
  } catch (err) {
    res.status(502).json({ error: "No pudimos conectar con el asistente. Intenta de nuevo." });
  }
}
