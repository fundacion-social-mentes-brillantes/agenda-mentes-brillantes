import { Timestamp } from "firebase/firestore";

export type EventType =
  | "session"
  | "meeting"
  | "task"
  | "reminder"
  | "family"
  | "foundation"
  | "personal"
  | "medical"
  | "payment"
  | "other";
export type EventStatus = "scheduled" | "confirmed" | "completed" | "cancelled";
export type EventModality = "presencial" | "virtual" | "llamada" | "otro";
export type EventPriority = "low" | "medium" | "high";

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  type: EventType;
  status: EventStatus;
  priority?: EventPriority;
  startAt: Date | Timestamp;
  endAt: Date | Timestamp;
  allDay: boolean;
  color: string;
  clientName?: string;
  participants?: string;
  personInCharge: string;
  modality: EventModality;
  location?: string;
  meetingLink?: string;
  reminderMinutes?: number | null;
  notes?: string;
  totalAmount?: number | null;
  paidAmount?: number | null;
  currency?: "COP";
  imageUrl?: string | null;
  imagePath?: string | null;
  createdBy: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}
