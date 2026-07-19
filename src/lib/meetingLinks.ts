import type { EventKind, EventModality, MeetingLinkType } from "../types/event";

export const EGO_ROOM_MEET_URL = "https://meet.google.com/pgk-svvh-brp";
export const STEPS_MEET_URL = "https://meet.google.com/zrt-matj-dwe";
export const COACH_MEET_URL = "https://meet.google.com/ouz-vnmr-fma";

export const FIXED_MEETING_LINKS = {
  ego_room: { label: "Sala de reducción del ego", url: EGO_ROOM_MEET_URL },
  steps: { label: "Entrega de pasos", url: STEPS_MEET_URL },
  coach: { label: "Sesión coach virtual", url: COACH_MEET_URL }
} as const;

export interface MeetingLinkInput {
  kind?: EventKind;
  modality?: EventModality;
  title?: string;
  meetingLinkType?: MeetingLinkType;
  meetingUrl?: string;
}

export interface ResolvedMeetingLink {
  meetingLinkType: MeetingLinkType;
  meetingUrl: string;
}

function normalizeTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function getFixedMeetingTypeForTitle(title = ""): "ego_room" | "steps" | null {
  const normalized = normalizeTitle(title);
  if (normalized.includes("reduccion del ego")) return "ego_room";
  if (normalized.includes("entrega de pasos") || normalized.includes("pasos virtual")) return "steps";
  return null;
}

export function isMeetingLinkType(value: unknown): value is MeetingLinkType {
  return value === "none" || value === "custom" || value === "ego_room" || value === "steps" || value === "coach";
}

export function normalizeMeetingUrl(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.protocol === "https:" ? parsed.href.replace(/\/$/, "") : "";
  } catch {
    return "";
  }
}

export function resolveMeetingLink(input: MeetingLinkInput): ResolvedMeetingLink {
  if (input.kind === "coach") {
    if (input.modality === "virtual") {
      return { meetingLinkType: "coach", meetingUrl: COACH_MEET_URL };
    }
    return { meetingLinkType: "none", meetingUrl: "" };
  }

  // Los enlaces institucionales solo corresponden a sus eventos virtuales.
  // Derivarlos del título hace que también aparezcan en los eventos antiguos.
  const titleType = input.modality === "virtual" ? getFixedMeetingTypeForTitle(input.title) : null;
  const requestedType = isMeetingLinkType(input.meetingLinkType) ? input.meetingLinkType : "none";
  if (titleType) {
    return { meetingLinkType: titleType, meetingUrl: FIXED_MEETING_LINKS[titleType].url };
  }
  // Los enlaces fijos ya no son opciones del formulario. Los demás eventos
  // normales sí pueden guardar cualquier URL HTTPS escrita por la persona.
  if (requestedType === "custom" || (!input.meetingLinkType && input.meetingUrl)) {
    return { meetingLinkType: "custom", meetingUrl: normalizeMeetingUrl(input.meetingUrl) };
  }
  return { meetingLinkType: "none", meetingUrl: "" };
}

export function getMeetingLinkLabel(type?: MeetingLinkType): string {
  if (type === "ego_room" || type === "steps" || type === "coach") return FIXED_MEETING_LINKS[type].label;
  return type === "custom" ? "Reunión virtual" : "Sin enlace";
}
