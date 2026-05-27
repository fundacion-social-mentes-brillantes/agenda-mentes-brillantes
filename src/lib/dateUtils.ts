import type { CalendarEvent } from "../types/event";

export function toDate(value: CalendarEvent["startAt"]): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    return value.toDate();
  }
  return new Date(value as Date);
}

export function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getDate() === second.getDate() &&
    first.getMonth() === second.getMonth() &&
    first.getFullYear() === second.getFullYear()
  );
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return "Todo el dia";
  const start = toDate(event.startAt);
  const end = toDate(event.endAt);
  const formatTime = (date: Date) =>
    date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function formatEventDate(event: CalendarEvent): string {
  return toDate(event.startAt).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

export function isEventPending(event: CalendarEvent): boolean {
  return event.status === "scheduled" || event.status === "confirmed";
}

