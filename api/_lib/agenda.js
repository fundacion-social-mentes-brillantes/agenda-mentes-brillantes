// Lógica de las herramientas del MCP (agendas, eventos, sesiones coach) sobre la
// capa Firestore multiusuario por REST. TODO corre con la identidad del usuario.
// Portado de mcp-server/src/agenda.ts pero sin firebase-admin.

import { UserFirestore, Ts } from "./firestore.js";

const TZ = process.env.AGENDA_TZ_OFFSET || "-05:00";
const DEFAULT_COLOR = "#d7b46a";
const COACH_COLOR = "#ec4899";

const FIXED_MEETINGS = {
  ego_room: "https://meet.google.com/pgk-svvh-brp",
  steps: "https://meet.google.com/zrt-matj-dwe"
};

function fixedMeetingForTitle(title, modality) {
  if (modality !== "virtual") return null;
  const n = String(title || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  if (n.includes("reduccion del ego")) return { meetingLinkType: "ego_room", meetingUrl: FIXED_MEETINGS.ego_room };
  if (n.includes("entrega de pasos") || n.includes("pasos virtual")) return { meetingLinkType: "steps", meetingUrl: FIXED_MEETINGS.steps };
  return null;
}

export function personalWorkspaceId(uid) {
  return `personal_${uid}`;
}

function toDate(date, time, fallbackTime) {
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : fallbackTime;
  const value = new Date(`${date}T${t}:00${TZ}`);
  if (Number.isNaN(value.getTime())) throw new Error(`Fecha u hora inválida: ${date} ${t}`);
  return value;
}

function parseTs(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function bogota(date, opts) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", ...opts }).format(date);
}

function friendly(date) {
  return bogota(date, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function hhmm(date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function isoDate(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function todayInBogota() {
  return isoDate(new Date());
}

function viewEvent(id, data) {
  const start = parseTs(data.startAt);
  const end = parseTs(data.endAt);
  const fixed = fixedMeetingForTitle(data.title || "", data.modality);
  return {
    id,
    title: data.title || "",
    date: start ? isoDate(start) : null,
    startAt: start ? start.toISOString() : null,
    endAt: end ? end.toISOString() : null,
    when: start ? friendly(start) : null,
    allDay: Boolean(data.allDay),
    modality: data.modality === "virtual" ? "virtual" : "presencial",
    color: data.color || DEFAULT_COLOR,
    kind: data.kind === "coach" ? "coach" : "normal",
    clientCode: typeof data.clientCode === "number" ? data.clientCode : null,
    clientName: data.clientName || null,
    reminderMinutes: typeof data.reminderMinutes === "number" ? data.reminderMinutes : null,
    totalAmount: typeof data.totalAmount === "number" ? data.totalAmount : null,
    paidAmount: typeof data.paidAmount === "number" ? data.paidAmount : null,
    meetingLinkType: fixed?.meetingLinkType || data.meetingLinkType || "none",
    meetingUrl: fixed?.meetingUrl || data.meetingUrl || "",
    done: data.done === true,
    workspaceId: data.workspaceId || ""
  };
}

// ------------------------------------------------------------------
// Agendas (workspaces) del usuario
// ------------------------------------------------------------------

export async function listWorkspaces(fs, uid) {
  const rows = await fs.runQuery({
    from: [{ collectionId: "members", allDescendants: true }],
    where: { fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: uid } } }
  });
  const out = [];
  for (const row of rows) {
    const parts = String(row.name).split("/documents/")[1]?.split("/") || [];
    const wsId = parts[0] === "workspaces" ? parts[1] : null;
    if (!wsId) continue;
    const ws = await fs.getDoc(`workspaces/${wsId}`);
    if (!ws) continue;
    out.push({
      id: wsId,
      name: ws.data.name || "Agenda",
      kind: ws.data.kind === "shared" ? "shared" : "personal",
      role: row.data.role || "editor"
    });
  }
  // La agenda personal siempre disponible aunque no tenga doc de miembro cargado.
  if (!out.some((w) => w.id === personalWorkspaceId(uid))) {
    out.unshift({ id: personalWorkspaceId(uid), name: "Mi agenda", kind: "personal", role: "owner" });
  }
  return out;
}

export async function resolveWorkspaceId(fs, uid, input) {
  if (input && input.trim()) {
    const workspaces = await listWorkspaces(fs, uid);
    const byId = workspaces.find((w) => w.id === input);
    if (byId) return byId.id;
    const byName = workspaces.find((w) => w.name.toLowerCase() === input.trim().toLowerCase());
    if (byName) return byName.id;
    throw new Error(`No encontré una agenda llamada "${input}". Usa list_workspaces para ver las disponibles.`);
  }
  // Sin agenda indicada: por defecto la del EQUIPO (primera compartida), no la personal.
  if (process.env.AGENDA_DEFAULT_WORKSPACE) return process.env.AGENDA_DEFAULT_WORKSPACE;
  const workspaces = await listWorkspaces(fs, uid);
  const shared = workspaces.find((w) => w.kind === "shared");
  return shared ? shared.id : personalWorkspaceId(uid);
}

async function allWorkspaceDocs(fs, workspaceId) {
  return fs.runQuery({
    from: [{ collectionId: "events" }],
    where: { fieldFilter: { field: { fieldPath: "workspaceId" }, op: "EQUAL", value: { stringValue: workspaceId } } },
    limit: 2000
  });
}

// ------------------------------------------------------------------
// Eventos
// ------------------------------------------------------------------

export async function listEvents(fs, uid, opts = {}) {
  const workspaceId = await resolveWorkspaceId(fs, uid, opts.workspace);
  const docs = await allWorkspaceDocs(fs, workspaceId);
  const fromDate = opts.from ? new Date(`${opts.from}T00:00:00${TZ}`) : null;
  const toLimit = opts.to ? new Date(`${opts.to}T23:59:59${TZ}`) : null;
  const q = (opts.query || "").trim().toLowerCase();

  let events = docs
    .filter((d) => d.data.recordType !== "client")
    .map((d) => viewEvent(d.id, d.data))
    .filter((e) => {
      if (!opts.includeDone && e.done) return false;
      if (q && !e.title.toLowerCase().includes(q)) return false;
      if (e.startAt) {
        const s = new Date(e.startAt);
        if (fromDate && s < fromDate) return false;
        if (toLimit && s > toLimit) return false;
      }
      return true;
    });

  events.sort((a, b) => (a.startAt || "").localeCompare(b.startAt || ""));
  if (opts.limit && opts.limit > 0) events = events.slice(0, opts.limit);
  return { workspaceId, events };
}

export async function todayAgenda(fs, uid, workspace) {
  const today = todayInBogota();
  return listEvents(fs, uid, { workspace, from: today, to: today, includeDone: true });
}

export async function getEvent(fs, uid, id) {
  const doc = await fs.getDoc(`events/${id}`);
  if (!doc) return null;
  // Las reglas ya bloquean lo ajeno; devolvemos la vista.
  return viewEvent(doc.id, doc.data);
}

function buildEventData({ workspaceId, uid, title, startAt, endAt, allDay, modality, color, reminderMinutes, totalAmount, paidAmount, kind, clientCode, clientName, createdByName }) {
  const hasMoney = typeof totalAmount === "number" || typeof paidAmount === "number";
  const fixed = fixedMeetingForTitle(title, modality);
  const data = {
    workspaceId,
    title: title.trim(),
    startAt: new Ts(startAt),
    endAt: new Ts(endAt),
    allDay: Boolean(allDay),
    color: color || (kind === "coach" ? COACH_COLOR : DEFAULT_COLOR),
    modality: modality === "virtual" ? "virtual" : "presencial",
    reminderMinutes: typeof reminderMinutes === "number" ? reminderMinutes : 30,
    totalAmount: typeof totalAmount === "number" ? totalAmount : null,
    paidAmount: typeof paidAmount === "number" ? paidAmount : null,
    meetingLinkType: fixed?.meetingLinkType || "none",
    meetingUrl: fixed?.meetingUrl || "",
    currency: hasMoney ? "COP" : null,
    attachments: [],
    done: false,
    createdBy: uid,
    createdByName: createdByName || "Asistente",
    createdAt: new Ts(new Date()),
    updatedAt: new Ts(new Date())
  };
  if (kind === "coach") {
    data.kind = "coach";
    if (typeof clientCode === "number") data.clientCode = clientCode;
    if (clientName) data.clientName = clientName;
    data.purchasedSessions = 1;
  }
  return data;
}

export async function createEvent(fs, uid, input, createdByName) {
  const workspaceId = await resolveWorkspaceId(fs, uid, input.workspace);
  if (!input.title?.trim()) throw new Error("El evento necesita un título.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("La fecha debe tener formato YYYY-MM-DD.");
  const allDay = Boolean(input.allDay);
  const startAt = allDay ? toDate(input.date, "00:00", "00:00") : toDate(input.date, input.startTime, "09:00");
  // Si dan inicio sin fin, dura 1 hora.
  const endAt = allDay
    ? toDate(input.date, "23:59", "23:59")
    : input.endTime
      ? toDate(input.date, input.endTime, "10:00")
      : new Date(startAt.getTime() + 60 * 60 * 1000);
  if (!allDay && endAt <= startAt) throw new Error("La hora final debe ser posterior a la de inicio.");

  const data = buildEventData({
    workspaceId, uid, title: input.title, startAt, endAt, allDay,
    modality: input.modality, color: input.color, reminderMinutes: input.reminderMinutes,
    totalAmount: input.totalAmount, paidAmount: input.paidAmount, createdByName
  });
  const doc = await fs.createDoc("events", data);
  return viewEvent(doc.id, doc.data);
}

export async function updateEvent(fs, uid, id, patch) {
  const current = await fs.getDoc(`events/${id}`);
  if (!current) throw new Error(`No existe un evento con id ${id}.`);
  const data = current.data;

  const update = { updatedAt: new Ts(new Date()) };
  if (patch.title !== undefined) update.title = String(patch.title).trim();
  if (patch.modality !== undefined) update.modality = patch.modality === "virtual" ? "virtual" : "presencial";
  if (patch.title !== undefined || patch.modality !== undefined) {
    const nextTitle = String(update.title ?? data.title ?? "");
    const nextModality = update.modality ?? data.modality;
    const fixed = fixedMeetingForTitle(nextTitle, nextModality);
    if (fixed) Object.assign(update, fixed);
    else if (data.meetingLinkType === "ego_room" || data.meetingLinkType === "steps") {
      update.meetingLinkType = "none";
      update.meetingUrl = "";
    }
  }
  if (patch.color !== undefined) update.color = patch.color;
  if (patch.reminderMinutes !== undefined) update.reminderMinutes = patch.reminderMinutes;
  if (patch.totalAmount !== undefined) update.totalAmount = patch.totalAmount;
  if (patch.paidAmount !== undefined) update.paidAmount = patch.paidAmount;
  if (patch.done !== undefined) update.done = Boolean(patch.done);

  const allDay = patch.allDay !== undefined ? Boolean(patch.allDay) : Boolean(data.allDay);
  if (patch.date !== undefined || patch.startTime !== undefined || patch.endTime !== undefined || patch.allDay !== undefined) {
    const curStart = parseTs(data.startAt);
    const curEnd = parseTs(data.endAt);
    // Duración original (para conservarla al mover, como Google Calendar). Por defecto 1 hora.
    const durationMs = curStart && curEnd ? Math.max(0, curEnd.getTime() - curStart.getTime()) : 60 * 60 * 1000;
    const base = patch.date || (curStart ? isoDate(curStart) : undefined);
    if (!base) throw new Error("No se pudo determinar la fecha del evento.");
    update.allDay = allDay;
    if (allDay) {
      update.startAt = new Ts(toDate(base, "00:00", "00:00"));
      update.endAt = new Ts(toDate(base, "23:59", "23:59"));
    } else {
      const nextStart = toDate(base, patch.startTime || (curStart ? hhmm(curStart) : undefined), "09:00");
      // Si NO dan hora de fin, se conserva la duración original a partir del nuevo inicio.
      const nextEnd = patch.endTime ? toDate(base, patch.endTime, "10:00") : new Date(nextStart.getTime() + durationMs);
      if (nextEnd <= nextStart) throw new Error("La hora final debe ser posterior a la de inicio.");
      update.startAt = new Ts(nextStart);
      update.endAt = new Ts(nextEnd);
    }
  }

  await fs.patchDoc(`events/${id}`, update);
  const fresh = await fs.getDoc(`events/${id}`);
  return viewEvent(fresh.id, fresh.data);
}

export async function deleteEvent(fs, id) {
  const current = await fs.getDoc(`events/${id}`);
  if (!current) throw new Error(`No existe un evento con id ${id}.`);
  await fs.deleteDoc(`events/${id}`);
}

// ------------------------------------------------------------------
// Sesiones coach: personas (clientes) y agendar
// ------------------------------------------------------------------

export async function listClients(fs, uid, workspace) {
  const workspaceId = await resolveWorkspaceId(fs, uid, workspace);
  const docs = await allWorkspaceDocs(fs, workspaceId);
  return docs
    .filter((d) => d.data.recordType === "client")
    .map((d) => ({
      code: typeof d.data.clientCode === "number" ? d.data.clientCode : Number(d.data.clientCode) || 0,
      name: d.data.clientName || "",
      id: d.id
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function addClient(fs, uid, workspace, name) {
  const workspaceId = await resolveWorkspaceId(fs, uid, workspace);
  const clean = String(name || "").trim();
  if (!clean) throw new Error("El nombre de la persona no puede estar vacío.");
  const docs = await allWorkspaceDocs(fs, workspaceId);
  const clients = docs.filter((d) => d.data.recordType === "client");
  if (clients.some((c) => String(c.data.clientName || "").trim().toLowerCase() === clean.toLowerCase())) {
    throw new Error(`Ya existe una persona llamada "${clean}".`);
  }
  const nextCode = clients.reduce((m, d) => Math.max(m, Number(d.data.clientCode) || 0), 0) + 1;
  const data = {
    workspaceId,
    recordType: "client",
    clientCode: nextCode,
    clientName: clean,
    nameLower: clean.toLowerCase(),
    active: true,
    createdBy: uid,
    createdAt: new Ts(new Date()),
    updatedAt: new Ts(new Date())
  };
  await fs.createDoc("events", data, `client_${workspaceId}_${nextCode}`);
  return { code: nextCode, name: clean };
}

export async function createCoachSession(fs, uid, input, createdByName) {
  const workspaceId = await resolveWorkspaceId(fs, uid, input.workspace);
  const clients = await listClients(fs, uid, workspaceId);
  let client = null;
  if (typeof input.clientCode === "number") client = clients.find((c) => c.code === input.clientCode) || null;
  if (!client && input.clientName) {
    const q = String(input.clientName).trim().toLowerCase();
    client = clients.find((c) => c.name.toLowerCase() === q) || clients.find((c) => c.name.toLowerCase().includes(q)) || null;
  }
  if (!client) throw new Error("No encontré a esa persona. Créala primero con add_client.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("La fecha debe tener formato YYYY-MM-DD.");

  const allDay = Boolean(input.allDay);
  const startAt = allDay ? toDate(input.date, "00:00", "00:00") : toDate(input.date, input.startTime, "09:00");
  const endAt = allDay
    ? toDate(input.date, "23:59", "23:59")
    : input.endTime
      ? toDate(input.date, input.endTime, "10:00")
      : new Date(startAt.getTime() + 60 * 60 * 1000);
  if (!allDay && endAt <= startAt) throw new Error("La hora final debe ser posterior a la de inicio.");

  const data = buildEventData({
    workspaceId, uid, title: client.name, startAt, endAt, allDay,
    modality: input.modality === "presencial" ? "presencial" : "virtual",
    color: COACH_COLOR, reminderMinutes: input.reminderMinutes,
    totalAmount: input.totalAmount, paidAmount: input.paidAmount,
    kind: "coach", clientCode: client.code, clientName: client.name, createdByName
  });
  const doc = await fs.createDoc("events", data);
  return { ...viewEvent(doc.id, doc.data), client };
}

export { UserFirestore };
