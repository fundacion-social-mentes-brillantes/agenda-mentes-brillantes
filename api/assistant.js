// Función de servidor (Vercel) para el asistente con DeepSeek (con herramientas / function-calling).
// La clave de DeepSeek vive aquí (DEEPSEEK_API_KEY), NUNCA en el navegador.
// Las herramientas (crear/editar/eliminar) las EJECUTA el navegador en la sesión del usuario,
// bajo las reglas de Firebase. El servidor solo conversa con DeepSeek y relé el mensaje.

const FIREBASE_API_KEY = "AIzaSyAfijrkvPKyIgnyfkYEJvjmYqT77disxHI"; // clave web pública (solo valida sesión)

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

function buildSystem({ workspaceName, userName, today, events }) {
  return [
    `Eres el asistente personal de la agenda "${workspaceName}" de ${userName || "el usuario"} (Gimnasio Emocional Mentes Brillantes).`,
    `Hoy es ${today}. Zona horaria de Colombia (UTC-5). Hablas español, eres cálido, claro y muy preciso.`,
    `Eres "uno con la agenda": CONSULTAS y también ACTÚAS con tus herramientas: crear, mover (update_event con nueva fecha/hora), duplicar (duplicate_event) y eliminar.`,
    ``,
    `Reglas (síguelas al pie de la letra):`,
    `- SÉ AUTOSUFICIENTE Y DECIDIDO: si la intención está clara, ACTÚA de una con la herramienta; NO pidas permiso ni propongas opciones. La única excepción es ELIMINAR (el navegador pedirá confirmación solo).`,
    `- "Duplicar/copiar X para tal día" → usa duplicate_event. "Mover/pasar/cambiar X a tal día/hora" → usa update_event. "Agéndame/crea" → create_event.`,
    `- Si piden duplicar/mover a varias fechas ("los próximos 3 martes", "toda la semana"), haz VARIAS llamadas, una por fecha.`,
    `- Fechas relativas ("mañana", "el próximo martes", "en 2 semanas", "fin de mes") → calcula la fecha real desde HOY.`,
    `- HORAS exactamente según lo que pida el usuario: si da inicio Y fin, usa ambas; si da SOLO la hora de inicio (ej. "a las 4"), NO inventes la hora de fin (déjala vacía: la app la pone 1 hora después, 4→5); si dice "todo el día", allDay=true; si no menciona hora, usa 09:00 (la app la deja de 1 hora). Al duplicar/mover sin hora nueva, conserva la del evento original.`,
    `- Usa el "id" exacto de la lista para mover/duplicar/borrar. Si hay varias coincidencias reales y no puedes elegir, SOLO ahí pregunta (corto).`,
    `- Si acabas de crear un evento y en el mismo pedido debes moverlo/duplicarlo, usa el id que devuelve create_event (texto "id=...") como id en la siguiente herramienta.`,
    `- Consultas (contar, sumar, fechas, "cuándo se creó"): usa SOLO la lista; exacto, con fechas; no inventes.`,
    ``,
    `ESTILO: MUY CONCISO. Responde en 1–2 frases. Tras actuar, confirma en una sola línea (ej. "Listo, dupliqué 'Sala de Reducción' al jueves 25."). Amplía o usa viñetas SOLO si te piden detalle o si listas varios resultados.`,
    ``,
    `Cada evento de la lista tiene: id, t=título, f=fecha (YYYY-MM-DD), h=hora, m=modalidad, vt=valor total, va=valor abonado, creado=fecha y hora en que se registró.`,
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

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { idToken, messages = [], events = [], today = "", workspaceName = "", userName = "" } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Faltan los mensajes de la conversación." });
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
  const safeEvents = Array.isArray(events) ? events.slice(0, 800) : [];
  const system = buildSystem({ workspaceName, userName, today, events: safeEvents });

  // Mensajes válidos para la API (sin system; lo agregamos nosotros).
  const convo = messages
    .filter((m) => m && typeof m === "object" && m.role)
    .map((m) => {
      const msg = { role: m.role };
      if (typeof m.content === "string") msg.content = m.content;
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (msg.content === undefined && !msg.tool_calls) msg.content = "";
      return msg;
    });

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
