import { Timestamp } from "firebase/firestore";

export type EventType = "session" | "task" | "reminder" | "family" | "foundation";
export type EventStatus = "scheduled" | "confirmed" | "completed" | "cancelled";
export type EventModality = "presencial" | "virtual" | "llamada" | "otro";

export interface CalendarEvent {
  id?: string;
  title: string;
  description: string;
  type: EventType;
  status: EventStatus;
  startAt: Date | Timestamp;
  endAt: Date | Timestamp;
  allDay: boolean;
  color: string;
  clientName?: string;
  personInCharge: string;
  modality: EventModality;
  location?: string;
  meetingLink?: string;
  reminderMinutes?: number;
  notes?: string;
  createdBy: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}
