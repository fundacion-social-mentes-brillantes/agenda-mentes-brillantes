import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { TimeoutError, withTimeout } from "../lib/asyncUtils";
import { toDateSafe } from "../lib/dateUtils";
import { DEFAULT_EVENT_COLOR } from "../lib/eventMeta";
import { getFixedMeetingTypeForTitle, resolveMeetingLink } from "../lib/meetingLinks";
import { auth, db } from "../lib/firebase";
import type { CalendarEvent, EventAttachment, EventKind, EventModality } from "../types/event";

const EVENT_WRITE_TIMEOUT = 15_000;
const PENDING_SYNC_MESSAGE = "El evento fue creado y se sincronizará automáticamente.";

export interface EventWriteResult {
  id: string;
  syncWarning?: string;
}

function getErrorDetails(error: unknown) {
  const maybeError = error as { code?: string; message?: string; name?: string };
  return {
    code: maybeError?.code || "",
    message: maybeError?.message || "",
    name: maybeError?.name || "",
    originalError: error
  };
}

function isOfflineLikeError(error: unknown): boolean {
  const { code, message, name } = getErrorDetails(error);
  return (
    code === "unavailable" ||
    name === "TimeoutError" ||
    /offline|network|client is offline|timeout|tiempo/i.test(message)
  );
}

function getEventErrorMessage(error: unknown): string {
  const { code } = getErrorDetails(error);

  if (code === "permission-denied") {
    return "No tienes permiso para guardar en esta agenda. Revisa las reglas de Firestore.";
  }
  if (code === "unavailable") {
    return "Firestore no está disponible en este momento.";
  }
  if (code === "unauthenticated") {
    return "Debes iniciar sesión para guardar eventos.";
  }
  if (isOfflineLikeError(error)) {
    return "No hay conexión con Firebase. El evento puede quedar pendiente de sincronización.";
  }
  return "No pudimos guardar el evento. Intenta nuevamente.";
}

function logEventError(action: string, error: unknown) {
  console.error(`${action} event failed`, getErrorDetails(error));
}

function assertValidDate(value: unknown, fieldName: string): Date {
  const date = toDateSafe(value, new Date(Number.NaN));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} no es una fecha válida.`);
  }
  return date;
}

function cleanTopLevelData<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function normalizeDescription(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 5000) : "";
}

function normalizeMoney(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeModality(value: unknown): EventModality {
  if (value === "virtual") return "virtual";
  if (value === "presencial") return "presencial";
  return "otro";
}

function normalizeKind(value: unknown): EventKind {
  return value === "coach" ? "coach" : "normal";
}

function normalizeAttachmentUrl(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function normalizeAttachments(value: unknown): EventAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && "url" in item && "path" in item)
    .map((item) => {
      const att = item as Partial<EventAttachment>;
      return {
        url: normalizeAttachmentUrl(att.url),
        path: String(att.path || ""),
        name: String(att.name || "archivo"),
        contentType: String(att.contentType || "application/octet-stream"),
        size: typeof att.size === "number" ? att.size : 0,
        kind: att.kind === "image" ? "image" : "file"
      } as EventAttachment;
    })
    .filter((att) => att.url);
}

/** Convierte un documento de Firestore (incluyendo eventos antiguos) al modelo actual. */
function mapDocToEvent(id: string, data: Record<string, any>): CalendarEvent {
  const now = new Date();
  const startAt = toDateSafe(data.startAt, now);
  const endAt = toDateSafe(data.endAt, startAt);

  let attachments = normalizeAttachments(data.attachments);
  if (attachments.length === 0 && data.imageUrl) {
    const imageUrl = normalizeAttachmentUrl(data.imageUrl);
    attachments = [
      {
        url: imageUrl,
        path: String(data.imagePath || ""),
        name: "Imagen",
        contentType: "image/*",
        size: 0,
        kind: "image"
      } as EventAttachment
    ].filter((att) => att.url);
  }

  const done = data.done === true || data.status === "completed" || data.status === "cancelled";
  const meeting = resolveMeetingLink({
    kind: normalizeKind(data.kind),
    modality: normalizeModality(data.modality),
    title: data.title,
    meetingLinkType: data.meetingLinkType,
    meetingUrl: data.meetingUrl
  });

  return {
    id,
    workspaceId: data.workspaceId || "",
    title: data.title || "",
    description: normalizeDescription(data.description),
    ...meeting,
    startAt,
    endAt,
    allDay: Boolean(data.allDay),
    color: data.color || DEFAULT_EVENT_COLOR,
    modality: normalizeModality(data.modality),
    kind: normalizeKind(data.kind),
    clientCode: typeof data.clientCode === "number" ? data.clientCode : null,
    clientName: data.clientName || null,
    purchasedSessions:
      typeof data.purchasedSessions === "number" ? data.purchasedSessions : normalizeKind(data.kind) === "coach" ? 1 : null,
    reminderMinutes: typeof data.reminderMinutes === "number" ? data.reminderMinutes : null,
    totalAmount: typeof data.totalAmount === "number" ? data.totalAmount : null,
    paidAmount: typeof data.paidAmount === "number" ? data.paidAmount : null,
    currency: data.currency || undefined,
    attachments,
    done,
    createdBy: data.createdBy || "",
    createdByName: data.createdByName || "",
    createdAt: toDateSafe(data.createdAt, now),
    updatedAt: toDateSafe(data.updatedAt, now),
    notes: data.notes || ""
  };
}

function sanitizeNewEvent(eventData: Partial<CalendarEvent>, uid: string): Record<string, unknown> {
  const startAt = eventData.startAt ? assertValidDate(eventData.startAt, "La fecha de inicio") : undefined;
  const endAt = eventData.endAt ? assertValidDate(eventData.endAt, "La fecha final") : undefined;

  if (!eventData.workspaceId) {
    throw new Error("Falta la agenda del evento.");
  }

  const meeting = resolveMeetingLink(eventData);

  return cleanTopLevelData({
    workspaceId: eventData.workspaceId,
    title: eventData.title?.trim() || "",
    description: normalizeDescription(eventData.description),
    ...meeting,
    startAt,
    endAt,
    allDay: Boolean(eventData.allDay),
    color: eventData.color || DEFAULT_EVENT_COLOR,
    modality: normalizeModality(eventData.modality),
    kind: normalizeKind(eventData.kind),
    clientCode: eventData.kind === "coach" && typeof eventData.clientCode === "number" ? eventData.clientCode : null,
    clientName: eventData.kind === "coach" && eventData.clientName ? eventData.clientName : null,
    purchasedSessions:
      eventData.kind === "coach" ? (typeof eventData.purchasedSessions === "number" && eventData.purchasedSessions >= 0 ? Math.floor(eventData.purchasedSessions) : 1) : null,
    reminderMinutes: typeof eventData.reminderMinutes === "number" ? eventData.reminderMinutes : null,
    totalAmount: normalizeMoney(eventData.totalAmount),
    paidAmount: normalizeMoney(eventData.paidAmount),
    currency: normalizeMoney(eventData.totalAmount) !== null || normalizeMoney(eventData.paidAmount) !== null ? "COP" : undefined,
    attachments: normalizeAttachments(eventData.attachments),
    done: Boolean(eventData.done),
    createdBy: uid,
    createdByName: eventData.createdByName || ""
  });
}

function sanitizeEventUpdate(eventData: Partial<CalendarEvent>): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (eventData.title !== undefined) data.title = eventData.title.trim();
  if (eventData.description !== undefined) data.description = normalizeDescription(eventData.description);
  const titleRequiresFixedLink = eventData.title !== undefined && getFixedMeetingTypeForTitle(eventData.title) !== null;
  if (eventData.meetingLinkType !== undefined || eventData.meetingUrl !== undefined || eventData.kind !== undefined || titleRequiresFixedLink) {
    Object.assign(data, resolveMeetingLink(eventData));
  }
  if (eventData.startAt !== undefined) data.startAt = assertValidDate(eventData.startAt, "La fecha de inicio");
  if (eventData.endAt !== undefined) data.endAt = assertValidDate(eventData.endAt, "La fecha final");
  if (eventData.allDay !== undefined) data.allDay = Boolean(eventData.allDay);
  if (eventData.color !== undefined) data.color = eventData.color || DEFAULT_EVENT_COLOR;
  if (eventData.modality !== undefined) data.modality = normalizeModality(eventData.modality);
  if (eventData.kind !== undefined) {
    const kind = normalizeKind(eventData.kind);
    data.kind = kind;
    if (kind !== "coach") {
      data.clientCode = null;
      data.clientName = null;
      data.purchasedSessions = null;
    }
  }
  if (eventData.clientCode !== undefined) data.clientCode = typeof eventData.clientCode === "number" ? eventData.clientCode : null;
  if (eventData.clientName !== undefined) data.clientName = eventData.clientName || null;
  if (eventData.purchasedSessions !== undefined) {
    data.purchasedSessions = typeof eventData.purchasedSessions === "number" && eventData.purchasedSessions >= 0 ? Math.floor(eventData.purchasedSessions) : 1;
  }
  if (eventData.reminderMinutes !== undefined) {
    data.reminderMinutes = typeof eventData.reminderMinutes === "number" ? eventData.reminderMinutes : null;
  }
  if (eventData.totalAmount !== undefined) data.totalAmount = normalizeMoney(eventData.totalAmount);
  if (eventData.paidAmount !== undefined) data.paidAmount = normalizeMoney(eventData.paidAmount);
  if (eventData.totalAmount !== undefined || eventData.paidAmount !== undefined) {
    const hasMoney = normalizeMoney(eventData.totalAmount) !== null || normalizeMoney(eventData.paidAmount) !== null;
    data.currency = hasMoney ? "COP" : null;
  }
  if (eventData.attachments !== undefined) data.attachments = normalizeAttachments(eventData.attachments);
  if (eventData.done !== undefined) data.done = Boolean(eventData.done);

  return cleanTopLevelData(data);
}

export const eventsService = {
  subscribeToEvents(
    workspaceId: string,
    onUpdate: (events: CalendarEvent[]) => void,
    onError?: (error: unknown) => void
  ) {
    if (!workspaceId) {
      onUpdate([]);
      return () => {};
    }

    const q = query(collection(db, "events"), where("workspaceId", "==", workspaceId));

    return onSnapshot(
      q,
      (snapshot) => {
        const events = snapshot.docs
          .filter((docSnap) => docSnap.data().recordType !== "client")
          .map((docSnap) => mapDocToEvent(docSnap.id, docSnap.data()))
          .sort((a, b) => toDateSafe(a.startAt).getTime() - toDateSafe(b.startAt).getTime());
        onUpdate(events);
      },
      (error) => {
        console.error("Subscribe events failed", getErrorDetails(error));
        if (onError) onError(error);
      }
    );
  },

  async createEvent(eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">): Promise<EventWriteResult> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error("Debes iniciar sesión para crear eventos.");
    }

    const docRef = doc(collection(db, "events"));
    const data = {
      ...sanitizeNewEvent(eventData, uid),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await withTimeout(setDoc(docRef, data), EVENT_WRITE_TIMEOUT, PENDING_SYNC_MESSAGE);
      return { id: docRef.id };
    } catch (error) {
      logEventError("Create", error);
      if (error instanceof TimeoutError || isOfflineLikeError(error)) {
        return { id: docRef.id, syncWarning: PENDING_SYNC_MESSAGE };
      }
      throw new Error(getEventErrorMessage(error));
    }
  },

  async updateEvent(eventId: string, eventData: Partial<CalendarEvent>): Promise<void> {
    const cleanData = sanitizeEventUpdate(eventData);
    delete cleanData.id;
    delete cleanData.createdAt;
    cleanData.updatedAt = serverTimestamp();

    try {
      await withTimeout(
        updateDoc(doc(db, "events", eventId), cleanData),
        EVENT_WRITE_TIMEOUT,
        "Los cambios se sincronizarán automáticamente."
      );
    } catch (error) {
      logEventError("Update", error);
      if (error instanceof TimeoutError || isOfflineLikeError(error)) {
        return;
      }
      throw new Error(getEventErrorMessage(error));
    }
  },

  async setEventDone(eventId: string, done: boolean): Promise<void> {
    try {
      await withTimeout(
        updateDoc(doc(db, "events", eventId), { done, updatedAt: serverTimestamp() }),
        EVENT_WRITE_TIMEOUT,
        "El cambio se sincronizará automáticamente."
      );
    } catch (error) {
      logEventError("Set done", error);
      if (error instanceof TimeoutError || isOfflineLikeError(error)) {
        return;
      }
      throw new Error(getEventErrorMessage(error));
    }
  },

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await withTimeout(
        deleteDoc(doc(db, "events", eventId)),
        EVENT_WRITE_TIMEOUT,
        "La eliminación se sincronizará automáticamente."
      );
    } catch (error) {
      logEventError("Delete", error);
      if (error instanceof TimeoutError || isOfflineLikeError(error)) {
        return;
      }
      throw new Error(getEventErrorMessage(error));
    }
  },

  /**
   * Migra eventos antiguos (sin agenda) creados por el usuario hacia su agenda personal.
   * Es idempotente: solo toca los que aún no tienen workspaceId.
   */
  async migrateLegacyEvents(uid: string, personalWorkspaceId: string): Promise<number> {
    const q = query(collection(db, "events"), where("createdBy", "==", uid));
    const snapshot = await getDocs(q);
    const legacy = snapshot.docs.filter((docSnap) => !docSnap.data().workspaceId);
    if (legacy.length === 0) return 0;

    // Firestore limita writeBatch a 500 operaciones; procesamos en lotes.
    const CHUNK = 450;
    for (let i = 0; i < legacy.length; i += CHUNK) {
      const batch = writeBatch(db);
      legacy.slice(i, i + CHUNK).forEach((docSnap) => {
        batch.update(docSnap.ref, { workspaceId: personalWorkspaceId, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }
    return legacy.length;
  }
};
