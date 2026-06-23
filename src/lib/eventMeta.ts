import type { EventModality } from "../types/event";

/** Color por defecto para un evento nuevo (dorado de la marca). */
export const DEFAULT_EVENT_COLOR = "#d7b46a";

/** Paleta de colores suaves y bonitos para elegir rápido. */
export const COLOR_PRESETS: { value: string; label: string }[] = [
  { value: "#d7b46a", label: "Dorado" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#8b5cf6", label: "Morado" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#10b981", label: "Verde" },
  { value: "#f59e0b", label: "Ámbar" },
  { value: "#ef4444", label: "Rojo" },
  { value: "#14b8a6", label: "Turquesa" },
  { value: "#6366f1", label: "Índigo" },
  { value: "#64748b", label: "Gris" }
];

export const MODALITY_OPTIONS: { value: EventModality; label: string }[] = [
  { value: "otro", label: "Otros" },
  { value: "presencial", label: "Presencial" },
  { value: "virtual", label: "Virtual" }
];

export function getModalityLabel(modality?: EventModality): string {
  return MODALITY_OPTIONS.find((item) => item.value === modality)?.label || "Otros";
}

export const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Sin recordatorio" },
  { value: 10, label: "Recordar 10 min antes" },
  { value: 30, label: "Recordar 30 min antes" },
  { value: 60, label: "Recordar 1 hora antes" },
  { value: 1440, label: "Recordar 1 día antes" }
];

export function getReminderLabel(minutes?: number | null): string {
  if (!minutes) return "Sin recordatorio";
  return REMINDER_OPTIONS.find((item) => item.value === minutes)?.label || `Recordar ${minutes} min antes`;
}
