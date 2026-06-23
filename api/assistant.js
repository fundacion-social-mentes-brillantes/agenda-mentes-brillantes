// Función de servidor (Vercel) para el asistente con DeepSeek.
// La clave de DeepSeek vive aquí (variable de entorno DEEPSEEK_API_KEY), NUNCA en el navegador.

// Clave web de Firebase (es pública: ya viaja al navegador). Sirve para validar la sesión.
const FIREBASE_API_KEY = "AIzaSyAfijrkvPKyIgnyfkYEJvjmYqT77disxHI";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { idToken, question, events = [], history = [], today = "", workspaceName = "" } = body;

  if (!question || !String(question).trim()) {
    res.status(400).json({ error: "Escribe una pregunta." });
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

  const system = [
    `Eres el asistente inteligente de la agenda "${workspaceName}" del Gimnasio Emocional Mentes Brillantes.`,
    `Hoy es ${today}. Responde SIEMPRE en español, claro, cálido y directo.`,
    `Tienes acceso a TODOS los eventos de esta agenda en formato JSON. Cada evento tiene:`,
    `t = título, f = fecha (YYYY-MM-DD), h = hora, m = modalidad (presencial/virtual/otro), vt = valor total, va = valor abonado, creado = fecha y hora en que se registró el evento.`,
    `Usa ÚNICAMENTE esos datos para responder. Puedes contar, filtrar por persona, por fecha, por mes, sumar pagos, listar fechas exactas, decir cuándo se creó un evento, etc.`,
    `Si te preguntan por una persona, búscala dentro de los títulos. Si no hay datos suficientes, dilo con honestidad y no inventes.`,
    `Cuando listes varios resultados, usa viñetas y muestra la fecha de cada uno.`,
    ``,
    `EVENTOS (${safeEvents.length}):`,
    JSON.stringify(safeEvents)
  ].join("\n");

  const trimmedHistory = (Array.isArray(history) ? history : [])
    .slice(-6)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");

  const messages = [{ role: "system", content: system }, ...trimmedHistory, { role: "user", content: String(question) }];

  try {
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.3, stream: false })
    });

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      res.status(502).json({ error: "El asistente no pudo responder en este momento.", detail });
      return;
    }

    const data = await r.json();
    const answer = data?.choices?.[0]?.message?.content || "No pude generar una respuesta.";
    res.status(200).json({ answer });
  } catch (err) {
    res.status(502).json({ error: "No pudimos conectar con el asistente. Intenta de nuevo." });
  }
}
