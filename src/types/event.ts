import { Timestamp } from "firebase/firestore";

export type EventModality = "presencial" | "virtual" | "otro";

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
