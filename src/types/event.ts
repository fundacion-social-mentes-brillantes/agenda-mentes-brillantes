import { Timestamp } from "firebase/firestore";

export type EventModality = "presencial" | "virtual" | "otro";

/** Tipo de evento: normal o sesión coach (ligada a una persona de la base de datos). */
export type EventKind = "normal" | "coach";

export type AttachmentKind = "image" | "file";

export interface EventAttachment {
  url: string;
  path: string;
  name: string;
  contentType: string;
  size: number;
  kind: AttachmentKind;
}

export interface CalendarEvent {
  id?: string;
  /** Agenda (workspace) a la que pertenece el evento. */
  workspaceId: string;
  title: string;
  startAt: Date | Timestamp;
  endAt: Date | Timestamp;
  allDay: boolean;
  color: string;
  modality: EventModality;
  /** "normal" (por defecto) o "coach" (sesión ligada a una persona). */
  kind?: EventKind;
  /** Código de la persona (solo en sesiones coach). */
  clientCode?: number | null;
  /** Nombre de la persona (solo en sesiones coach; se guarda denormalizado). */
  clientName?: string | null;
  /** Sesiones compradas en esta compra (solo coach; por defecto 1, ej. 24 si es un paquete). */
  purchasedSessions?: number | null;
  reminderMinutes?: number | null;
  totalAmount?: number | null;
  paidAmount?: number | null;
  currency?: "COP";
  attachments?: EventAttachment[];
  /** Marca simple de "hecho" para tachar el evento. */
  done?: boolean;
  createdBy: string;
  createdByName?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;

  // --- Campos heredados (solo lectura, por compatibilidad con eventos antiguos) ---
  /** @deprecated ya no se edita; se conserva para leer eventos creados antes. */
  notes?: string;
  /** @deprecated ya no se edita; se conserva para leer eventos creados antes. */
  description?: string;
  /** @deprecated imagen única antigua; ahora se usa attachments. */
  imageUrl?: string | null;
  /** @deprecated ruta de imagen única antigua. */
  imagePath?: string | null;
}
