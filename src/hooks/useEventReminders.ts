import { useEffect, useRef } from "react";
import { toDate } from "../lib/dateUtils";
import type { CalendarEvent } from "../types/event";

const LEAD_MS = 15 * 60 * 1000;
const STORAGE_KEY = "remindersNotified";

function loadNotified(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const now = Date.now();
    const arr: string[] = JSON.parse(raw);
    // Conserva solo recordatorios de eventos aún recientes (su hora > ayer).
    return new Set(arr.filter((k) => Number(k.split(":")[1] || 0) > now - 86_400_000));
  } catch {
    return new Set();
  }
}

function saveNotified(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* sin almacenamiento */
  }
}

async function showReminder(title: string, when: string) {
  const body = `Empieza a las ${when} (en unos 15 minutos).`;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && reg.showNotification) {
      await reg.showNotification("⏰ " + title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: title + when
      });
      return;
    }
  } catch {
    /* intenta el modo simple */
  }
  try {
    // eslint-disable-next-line no-new
    new Notification("⏰ " + title, { body, icon: "/icons/icon-192.png" });
  } catch {
    /* no soportado */
  }
}

/** Avisa con una notificación ~15 minutos antes de cada evento (mientras la app esté abierta/activa). */
export function useEventReminders(events: CalendarEvent[]) {
  const notifiedRef = useRef<Set<string>>(loadNotified());
  const eventsRef = useRef<CalendarEvent[]>(events);
  eventsRef.current = events;

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const check = () => {
      if (Notification.permission !== "granted") return;
      const now = Date.now();
      for (const ev of eventsRef.current) {
        if (!ev.id || ev.allDay) continue;
        const start = toDate(ev.startAt).getTime();
        const diff = start - now;
        const key = `${ev.id}:${start}`;
        if (diff > 0 && diff <= LEAD_MS && !notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          saveNotified(notifiedRef.current);
          const when = toDate(ev.startAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
          void showReminder(ev.title, when);
        }
      }
    };

    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, []);
}
