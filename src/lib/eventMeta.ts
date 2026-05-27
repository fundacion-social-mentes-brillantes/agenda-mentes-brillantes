import type { EventPriority, EventStatus, EventType } from "../types/event";

export interface EventTypeMeta {
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  softClass: string;
}

export const EVENT_TYPES: Record<EventType, EventTypeMeta> = {
  session: {
    label: "Sesión Coach",
    shortLabel: "Sesión Coach",
    description: "Acompañamiento coach o gimnasio emocional.",
    color: "#3b82f6",
    softClass: "bg-blue-500/10 text-blue-600 border-blue-500/20"
  },
  meeting: {
    label: "Reunion",
    shortLabel: "Reunion",
    description: "Encuentro familiar, institucional o de equipo.",
    color: "#6366f1",
    softClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
  },
  task: {
    label: "Tarea",
    shortLabel: "Tarea",
    description: "Accion pendiente con responsable.",
    color: "#8b5cf6",
    softClass: "bg-violet-500/10 text-violet-600 border-violet-500/20"
  },
  reminder: {
    label: "Recordatorio",
    shortLabel: "Record.",
    description: "Aviso visual para no olvidar algo importante.",
    color: "#d97706",
    softClass: "bg-amber-500/10 text-amber-700 border-amber-500/20"
  },
  family: {
    label: "Familia",
    shortLabel: "Familia",
    description: "Actividad o compromiso familiar.",
    color: "#10b981",
    softClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
  },
  foundation: {
    label: "Fundacion",
    shortLabel: "Fund.",
    description: "Actividad de la fundacion o institucion.",
    color: "#ec4899",
    softClass: "bg-pink-500/10 text-pink-600 border-pink-500/20"
  },
  personal: {
    label: "Personal",
    shortLabel: "Personal",
    description: "Tiempo propio, estudio o cuidado personal.",
    color: "#14b8a6",
    softClass: "bg-teal-500/10 text-teal-600 border-teal-500/20"
  },
  medical: {
    label: "Salud",
    shortLabel: "Salud",
    description: "Cita medica, terapia o bienestar fisico.",
    color: "#ef4444",
    softClass: "bg-red-500/10 text-red-600 border-red-500/20"
  },
  payment: {
    label: "Pago",
    shortLabel: "Pago",
    description: "Cobro, pago o compromiso financiero.",
    color: "#f59e0b",
    softClass: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
  },
  other: {
    label: "Otro",
    shortLabel: "Otro",
    description: "Cualquier evento que no encaje en otro tipo.",
    color: "#64748b",
    softClass: "bg-slate-500/10 text-slate-600 border-slate-500/20"
  }
};

export const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPES).map(([value, meta]) => ({
  value: value as EventType,
  ...meta
}));

export const EVENT_STATUS_OPTIONS: { value: EventStatus; label: string; softClass: string }[] = [
  { value: "scheduled", label: "Pendiente", softClass: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  { value: "confirmed", label: "Confirmado", softClass: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  { value: "completed", label: "Realizado", softClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { value: "cancelled", label: "Cancelado", softClass: "bg-red-500/10 text-red-600 border-red-500/20" }
];

export const PRIORITY_OPTIONS: { value: EventPriority; label: string; softClass: string }[] = [
  { value: "low", label: "Baja", softClass: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  { value: "medium", label: "Media", softClass: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  { value: "high", label: "Alta", softClass: "bg-rose-500/10 text-rose-600 border-rose-500/20" }
];

export const REMINDER_OPTIONS = [
  { value: 0, label: "Sin recordatorio" },
  { value: 10, label: "Recordar 10 min antes" },
  { value: 30, label: "Recordar 30 min antes" },
  { value: 60, label: "Recordar 1 hora antes" },
  { value: 1440, label: "Recordar 1 dia antes" }
];

export function getEventMeta(type?: EventType): EventTypeMeta {
  return EVENT_TYPES[type || "other"] || EVENT_TYPES.other;
}

export function getStatusMeta(status?: EventStatus) {
  return EVENT_STATUS_OPTIONS.find((item) => item.value === status) || EVENT_STATUS_OPTIONS[0];
}

export function getPriorityMeta(priority?: EventPriority) {
  return PRIORITY_OPTIONS.find((item) => item.value === priority) || PRIORITY_OPTIONS[1];
}
