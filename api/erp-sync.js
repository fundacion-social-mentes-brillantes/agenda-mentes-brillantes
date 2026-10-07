// Función de servidor (Vercel): reporta al ERP las sesiones coach de la agenda.
//
// IMPORTANTE: esto NO cambia nada en la contabilidad. Solo le cuenta al ERP
// qué hay en el calendario para que él pueda comparar y avisarle al dueño de
// las diferencias (sesiones que ya pasaron sin registrar, fechas movidas,
// eventos borrados que ya estaban cobrados). Quien decide qué se registra es
// una persona, desde el ERP.
//
// El secreto vive SOLO en el servidor. Y no basta con tener cuenta: hay que ser
// del equipo (estar invitado a una agenda compartida), porque un reporte falso
// puede hacer que el ERP dé por borradas sesiones que sí existen.

import { UserFirestore, verifyIdToken } from "./_lib/firestore.js";
import { agendasDelEquipo } from "./_lib/agenda.js";

const ERP_BASE_URL = process.env.ERP_BASE_URL || "https://mentes-brillantes-erp.vercel.app";
const MAX_EVENTOS = 500;

function parseBody(body) {
  if (typeof body !== "string") return body && typeof body === "object" ? body : {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  const secreto = process.env.ERP_SHARED_SECRET;
  if (!secreto) {
    res.status(503).json({ error: "La conexión con el ERP no está configurada." });
    return;
  }

  const body = parseBody(req.body);
  const user = await verifyIdToken(body.idToken);
  if (!user) {
    res.status(401).json({ error: "Tu sesión no es válida." });
    return;
  }

  const equipo = await agendasDelEquipo(new UserFirestore(body.idToken), user.localId);
  if (!equipo.size) {
    res.status(403).json({ error: "Esta parte es solo para el equipo de la fundación." });
    return;
  }

  const workspaceId = String(body.workspaceId || "").slice(0, 128);
  const desde = String(body.desde || "").slice(0, 10);
  const hasta = String(body.hasta || "").slice(0, 10);
  if (!workspaceId || !ES_FECHA.test(desde) || !ES_FECHA.test(hasta)) {
    res.status(400).json({ error: "Faltan la agenda o la ventana de fechas." });
    return;
  }
  // Solo se reporta la agenda del equipo, y solo la puede reportar alguien de ella.
  if (!equipo.has(workspaceId)) {
    res.status(403).json({ error: "Esa agenda no es la del equipo." });
    return;
  }

  // Solo se envían sesiones coach: el resto del calendario (reuniones,
  // festivos, citas médicas) no tiene nada que ver con la contabilidad y no
  // debe salir de la agenda.
  const eventos = (Array.isArray(body.eventos) ? body.eventos : [])
    // Codigo entero positivo: un "" pasaba como 0 (Number("") es 0).
    .filter((e) => e && e.kind === "coach" && Number.isInteger(Number(e.clientCode)) && Number(e.clientCode) > 0 && String(e.clientCode).trim() !== "")
    .slice(0, MAX_EVENTOS)
    .map((e) => ({
      id: String(e.id || "").slice(0, 128),
      workspaceId,
      clientCode: Number(e.clientCode),
      clientName: typeof e.clientName === "string" ? e.clientName.slice(0, 160) : null,
      date: String(e.date || "").slice(0, 10),
      startAt: e.startAt || null,
      title: typeof e.title === "string" ? e.title.slice(0, 300) : null,
      modality: e.modality || null,
      done: Boolean(e.done)
    }))
    .filter((e) => e.id && ES_FECHA.test(e.date));

  try {
    const r = await fetch(`${ERP_BASE_URL}/api/integraciones/agenda/sincronizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-agenda-secret": secreto },
      body: JSON.stringify({ workspaceId, desde, hasta, eventos })
    });

    if (!r.ok) {
      console.error("[erp-sync] respuesta no OK", r.status);
      res.status(502).json({ error: "No se pudo avisar al ERP en este momento." });
      return;
    }

    res.status(200).json(await r.json());
  } catch (error) {
    console.error("[erp-sync] fallo de red", error?.message);
    res.status(502).json({ error: "No se pudo avisar al ERP en este momento." });
  }
}
