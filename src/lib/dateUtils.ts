import type { CalendarEvent } from "../types/event";

export function toDateSafe(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : fallback;
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date;
  }
  return fallback;
}

export function toDate(value: CalendarEvent["startAt"]): Date {
  return toDateSafe(value);
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

export function formatCOP(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value);
}
