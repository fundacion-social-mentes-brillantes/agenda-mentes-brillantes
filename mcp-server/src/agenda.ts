import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb, getOwnerUid, getTzOffset } from "./firebase.js";

export function personalWorkspaceId(uid: string): string {
  return `personal_${uid}`;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  kind: string;
  role: string;
}

export interface EventInput {
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  allDay?: boolean;
  modality?: "presencial" | "virtual";
  color?: string;
  reminderMinutes?: number;
  totalAmount?: number;
  paidAmount?: number;
  workspace?: string; // id o nombre
}

function tz(): string {
  return getTzOffset();
}

function toDate(date: string, time: string | undefined, fallbackTime: string): Date {
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : fallbackTime;
  const value = new Date(`${date}T${t}:00${tz()}`);
  if (Number.isNaN(value.getTime())) {
    throw new Error(`Fecha u hora invalida: ${date} ${t}`);
  }
  return value;
}

function friendly(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota"
  }).format(date);
}

function tsToDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function toBogotaTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export interface EventView {
  id: string;
  title: string;
  startAt: string | null;
  endAt: string | null;
  when: string | null;
  allDay: boolean;
  modality: string;
  color: string;
  reminderMinutes: number | null;
  totalAmount: number | null;
  paidAmount: number | null;
  done: boolean;
  workspaceId: string;
}

function viewEvent(id: string, data: FirebaseFirestore.DocumentData): EventView {
  const start = tsToDate(data.startAt);
  const end = tsToDate(data.endAt);
  return {
    id,
    title: data.title || "",
    startAt: start ? start.toISOString() : null,
    endAt: end ? end.toISOString() : null,
    when: start ? friendly(start) : null,
    allDay: Boolean(data.allDay),
    modality: data.modality === "virtual" ? "virtual" : "presencial",
    color: data.color || "#d7b46a",
    reminderMinutes: typeof data.reminderMinutes === "number" ? data.reminderMinutes : null,
    totalAmount: typeof data.totalAmount === "number" ? data.totalAmount : null,
    paidAmount: typeof data.paidAmount === "number" ? data.paidAmount : null,
    done: data.done === true,
    workspaceId: data.workspaceId || ""
  };
}

export async function listWorkspaces(): Promise<WorkspaceInfo[]> {
  const db = getDb();
  const uid = getOwnerUid();
  const snap = await db.collectionGroup("members").where("uid", "==", uid).get();

  const items = await Promise.all(
    snap.docs.map(async (docSnap) => {
      const wsRef = docSnap.ref.parent.parent;
      if (!wsRef) return null;
      const wsSnap = await wsRef.get();
      if (!wsSnap.exists) return null;
      const data = wsSnap.data() || {};
      return {
        id: wsRef.id,
        name: data.name || "Agenda",
        kind: data.kind === "shared" ? "shared" : "personal",
        role: docSnap.data().role || "editor"
      } as WorkspaceInfo;
    })
  );

  return items.filter((x): x is WorkspaceInfo => x !== null);
}

export async function resolveWorkspaceId(input?: string): Promise<string> {
  const uid = getOwnerUid();
  const fallback = process.env.AGENDA_DEFAULT_WORKSPACE || personalWorkspaceId(uid);
  if (!input || !input.trim()) return fallback;

  const workspaces = await listWorkspaces();
  const byId = workspaces.find((ws) => ws.id === input);
  if (byId) return byId.id;
  const byName = workspaces.find((ws) => ws.name.toLowerCase() === input.trim().toLowerCase());
  if (byName) return byName.id;
  throw new Error(
    `No encontré una agenda llamada "${input}". Usa la herramienta list_workspaces para ver las agendas disponibles.`
  );
}

async function ownerWorkspaceIds(): Promise<Set<string>> {
  const uid = getOwnerUid();
  const ids = new Set((await listWorkspaces()).map((ws) => ws.id));
  ids.add(personalWorkspaceId(uid));
  return ids;
}

async function getOwnedEventSnapshot(id: string): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  const db = getDb();
  const snap = await db.collection("events").doc(id).get();
  if (!snap.exists) return null;

  const workspaceId = String((snap.data() || {}).workspaceId || "");
  const allowed = await ownerWorkspaceIds();
  if (!workspaceId || !allowed.has(workspaceId)) {
    throw new Error("No tienes permiso para acceder a ese evento desde esta agenda.");
  }

  return snap;
}

export async function listEvents(opts: {
  workspace?: string;
  from?: string;
  to?: string;
  query?: string;
  includeDone?: boolean;
  limit?: number;
}): Promise<{ workspaceId: string; events: EventView[] }> {
  const db = getDb();
  const workspaceId = await resolveWorkspaceId(opts.workspace);
  const snap = await db.collection("events").where("workspaceId", "==", workspaceId).get();

  const fromDate = opts.from ? new Date(`${opts.from}T00:00:00${tz()}`) : null;
  const toDateLimit = opts.to ? new Date(`${opts.to}T23:59:59${tz()}`) : null;
  const queryText = opts.query?.trim().toLowerCase() || "";

  let events = snap.docs.map((d) => viewEvent(d.id, d.data()));

  events = events.filter((e) => {
    if (!opts.includeDone && e.done) return false;
    if (queryText && !e.title.toLowerCase().includes(queryText)) return false;
    if (e.startAt) {
      const start = new Date(e.startAt);
      if (fromDate && start < fromDate) return false;
      if (toDateLimit && start > toDateLimit) return false;
    }
    return true;
  });

  events.sort((a, b) => (a.startAt || "").localeCompare(b.startAt || ""));
  if (opts.limit && opts.limit > 0) events = events.slice(0, opts.limit);

  return { workspaceId, events };
}

export async function getEvent(id: string): Promise<EventView | null> {
  const snap = await getOwnedEventSnapshot(id);
  if (!snap) return null;
  return viewEvent(snap.id, snap.data() || {});
}

export async function createEvent(input: EventInput): Promise<EventView> {
  const db = getDb();
  const uid = getOwnerUid();
  const workspaceId = await resolveWorkspaceId(input.workspace);

  if (!input.title?.trim()) throw new Error("El evento necesita un titulo.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("La fecha debe tener formato YYYY-MM-DD.");

  const allDay = Boolean(input.allDay);
  const startAt = allDay ? toDate(input.date, "00:00", "00:00") : toDate(input.date, input.startTime, "09:00");
  const endAt = allDay ? toDate(input.date, "23:59", "23:59") : toDate(input.date, input.endTime, "10:00");
  if (!allDay && endAt <= startAt) {
    throw new Error("La hora final debe ser posterior a la de inicio.");
  }

  const hasMoney = typeof input.totalAmount === "number" || typeof input.paidAmount === "number";
  const data: FirebaseFirestore.DocumentData = {
    workspaceId,
    title: input.title.trim(),
    startAt: Timestamp.fromDate(startAt),
    endAt: Timestamp.fromDate(endAt),
    allDay,
    color: input.color || "#d7b46a",
    modality: input.modality === "virtual" ? "virtual" : "presencial",
    reminderMinutes: typeof input.reminderMinutes === "number" ? input.reminderMinutes : 30,
    totalAmount: typeof input.totalAmount === "number" ? input.totalAmount : null,
    paidAmount: typeof input.paidAmount === "number" ? input.paidAmount : null,
    currency: hasMoney ? "COP" : null,
    attachments: [],
    done: false,
    createdBy: uid,
    createdByName: "Asistente",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  const ref = await db.collection("events").add(data);
  const snap = await ref.get();
  return viewEvent(ref.id, snap.data() || {});
}

export async function updateEvent(
  id: string,
  patch: Partial<EventInput> & { done?: boolean }
): Promise<EventView> {
  const db = getDb();
  const ref = db.collection("events").doc(id);
  const current = await getOwnedEventSnapshot(id);
  if (!current) throw new Error(`No existe un evento con id ${id}.`);
  const data = current.data() || {};

  const update: FirebaseFirestore.DocumentData = { updatedAt: FieldValue.serverTimestamp() };
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.modality !== undefined) update.modality = patch.modality === "virtual" ? "virtual" : "presencial";
  if (patch.color !== undefined) update.color = patch.color;
  if (patch.reminderMinutes !== undefined) update.reminderMinutes = patch.reminderMinutes;
  if (patch.totalAmount !== undefined) update.totalAmount = patch.totalAmount;
  if (patch.paidAmount !== undefined) update.paidAmount = patch.paidAmount;
  if (patch.done !== undefined) update.done = patch.done;

  const allDay = patch.allDay !== undefined ? patch.allDay : Boolean(data.allDay);
  if (patch.date !== undefined || patch.startTime !== undefined || patch.endTime !== undefined || patch.allDay !== undefined) {
    const currentStart = tsToDate(data.startAt);
    const currentEnd = tsToDate(data.endAt);
    const baseDate = patch.date || (currentStart ? toIsoDate(currentStart) : undefined);
    if (!baseDate) throw new Error("No se pudo determinar la fecha del evento.");
    update.allDay = allDay;
    const nextStart = allDay
      ? toDate(baseDate, "00:00", "00:00")
      : toDate(baseDate, patch.startTime || (currentStart ? toBogotaTime(currentStart) : undefined), "09:00");
    const nextEnd = allDay
      ? toDate(baseDate, "23:59", "23:59")
      : toDate(baseDate, patch.endTime || (currentEnd ? toBogotaTime(currentEnd) : undefined), "10:00");
    if (!allDay && nextEnd <= nextStart) {
      throw new Error("La hora final debe ser posterior a la de inicio.");
    }
    update.startAt = Timestamp.fromDate(nextStart);
    update.endAt = Timestamp.fromDate(nextEnd);
  }

  await ref.update(update);
  const fresh = await ref.get();
  return viewEvent(ref.id, fresh.data() || {});
}

export async function deleteEvent(id: string): Promise<void> {
  const db = getDb();
  const current = await getOwnedEventSnapshot(id);
  if (!current) throw new Error(`No existe un evento con id ${id}.`);
  await db.collection("events").doc(id).delete();
}

function toIsoDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
