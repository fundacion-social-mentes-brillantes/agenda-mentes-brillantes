import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { TimeoutError, withTimeout } from "../lib/asyncUtils";
import { toDateSafe } from "../lib/dateUtils";
import { getEventMeta } from "../lib/eventMeta";
import { auth, db } from "../lib/firebase";
import type { CalendarEvent, EventStatus, EventType } from "../types/event";

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
    return "No tienes permiso para guardar eventos. Revisa las reglas de Firestore.";
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
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
}

function normalizeMoney(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeEventData(
  eventData: Partial<CalendarEvent>,
  uid?: string
): Record<string, unknown> {
  const startAt = eventData.startAt ? assertValidDate(eventData.startAt, "La fecha de inicio") : undefined;
  const endAt = eventData.endAt ? assertValidDate(eventData.endAt, "La fecha final") : undefined;

  return cleanTopLevelData({
    title: eventData.title?.trim() || "",
    description: eventData.description?.trim() || "",
    type: eventData.type || "other",
    status: eventData.status || "scheduled",
    priority: eventData.priority || "medium",
    startAt,
    endAt,
    allDay: Boolean(eventData.allDay),
    color: eventData.color || getEventMeta(eventData.type).color,
    clientName: eventData.clientName ?? "",
    participants: eventData.participants ?? "",
    personInCharge: eventData.personInCharge?.trim() || "",
    modality: eventData.modality || "otro",
    location: eventData.location ?? "",
    meetingLink: eventData.meetingLink ?? "",
    reminderMinutes: typeof eventData.reminderMinutes === "number" ? eventData.reminderMinutes : null,
    notes: eventData.notes ?? "",
    totalAmount: normalizeMoney(eventData.totalAmount),
    paidAmount: normalizeMoney(eventData.paidAmount),
    currency: eventData.type === "session" ? "COP" : eventData.currency,
    imageUrl: eventData.imageUrl ?? null,
    imagePath: eventData.imagePath ?? null,
    createdBy: uid || eventData.createdBy || ""
  });
}

function sanitizeEventUpdateData(eventData: Partial<CalendarEvent>): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (eventData.title !== undefined) data.title = eventData.title.trim();
  if (eventData.description !== undefined) data.description = eventData.description.trim();
  if (eventData.type !== undefined) data.type = eventData.type;
  if (eventData.status !== undefined) data.status = eventData.status;
  if (eventData.priority !== undefined) data.priority = eventData.priority;
  if (eventData.startAt !== undefined) data.startAt = assertValidDate(eventData.startAt, "La fecha de inicio");
  if (eventData.endAt !== undefined) data.endAt = assertValidDate(eventData.endAt, "La fecha final");
  if (eventData.allDay !== undefined) data.allDay = Boolean(eventData.allDay);
  if (eventData.color !== undefined) data.color = eventData.color || getEventMeta(eventData.type).color;
  if (eventData.clientName !== undefined) data.clientName = eventData.clientName ?? "";
  if (eventData.participants !== undefined) data.participants = eventData.participants ?? "";
  if (eventData.personInCharge !== undefined) data.personInCharge = eventData.personInCharge.trim();
  if (eventData.modality !== undefined) data.modality = eventData.modality;
  if (eventData.location !== undefined) data.location = eventData.location ?? "";
  if (eventData.meetingLink !== undefined) data.meetingLink = eventData.meetingLink ?? "";
  if (eventData.reminderMinutes !== undefined) {
    data.reminderMinutes = typeof eventData.reminderMinutes === "number" ? eventData.reminderMinutes : null;
  }
  if (eventData.notes !== undefined) data.notes = eventData.notes ?? "";
  if (eventData.totalAmount !== undefined) data.totalAmount = normalizeMoney(eventData.totalAmount);
  if (eventData.paidAmount !== undefined) data.paidAmount = normalizeMoney(eventData.paidAmount);
  if (eventData.currency !== undefined) data.currency = eventData.currency;
  if (eventData.imageUrl !== undefined) data.imageUrl = eventData.imageUrl ?? null;
  if (eventData.imagePath !== undefined) data.imagePath = eventData.imagePath ?? null;
  if (eventData.createdBy !== undefined) data.createdBy = eventData.createdBy;

  return cleanTopLevelData(data);
}

export const eventsService = {
  subscribeToEvents(onUpdate: (events: CalendarEvent[]) => void, onError?: (error: unknown) => void) {
    const q = query(
      collection(db, "events"),
      orderBy("startAt", "asc")
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const now = new Date();
        const events: CalendarEvent[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const type = (data.type || "other") as EventType;
          const meta = getEventMeta(type);
          const startAt = toDateSafe(data.startAt, now);
          const endAt = toDateSafe(data.endAt, startAt);

          return {
            id: docSnap.id,
            ...data,
            type,
            status: data.status || "scheduled",
            priority: data.priority || "medium",
            color: data.color || meta.color,
            description: data.description || "",
            participants: data.participants || data.clientName || "",
            reminderMinutes: typeof data.reminderMinutes === "number" ? data.reminderMinutes : null,
            totalAmount: typeof data.totalAmount === "number" ? data.totalAmount : null,
            paidAmount: typeof data.paidAmount === "number" ? data.paidAmount : null,
            currency: data.currency || (type === "session" ? "COP" : undefined),
            imageUrl: data.imageUrl || null,
            imagePath: data.imagePath || null,
            startAt,
            endAt,
            createdAt: toDateSafe(data.createdAt, now),
            updatedAt: toDateSafe(data.updatedAt, now)
          } as CalendarEvent;
        });
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
      ...sanitizeEventData(eventData, uid),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await withTimeout(
        setDoc(docRef, data),
        EVENT_WRITE_TIMEOUT,
        PENDING_SYNC_MESSAGE
      );
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
    const cleanData = sanitizeEventUpdateData(eventData);
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

  async updateEventStatus(eventId: string, status: EventStatus): Promise<void> {
    try {
      await withTimeout(
        updateDoc(doc(db, "events", eventId), {
          status,
          updatedAt: serverTimestamp()
        }),
        EVENT_WRITE_TIMEOUT,
        "El estado se sincronizará automáticamente."
      );
    } catch (error) {
      logEventError("Update status", error);
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
  }
};
