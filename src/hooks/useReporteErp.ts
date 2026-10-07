import { useEffect, useRef } from "react";
import { aFechaIso, reportarSesionesAlErp } from "../services/erpService";
import type { CalendarEvent } from "../types/event";
import { toDate } from "../lib/dateUtils";

const VENTANA_ATRAS_DIAS = 45;
const VENTANA_ADELANTE_DIAS = 30;
/** No tiene sentido reportar en cada render: basta una vez cada tanto. */
const CADA_MS = 30 * 60 * 1000;

/**
 * Le reporta al ERP las sesiones coach de UNA agenda (la del equipo), para que
 * el dueño pueda revisar diferencias. No modifica nada aquí ni allá: es solo un
 * aviso.
 *
 * `events` trae todo lo visible (varias agendas a la vez), así que aquí se
 * queda solo con lo de `workspaceId`: si no, sesiones del equipo terminaban
 * reportadas como de una agenda personal, y el ERP las rechaza.
 */
export function useReporteErp(workspaceId: string | null, events: CalendarEvent[], enabled = true) {
  const ultimoEnvio = useRef(0);

  useEffect(() => {
    if (!enabled || !workspaceId || !events.length) return;

    const ahora = Date.now();
    if (ahora - ultimoEnvio.current < CADA_MS) return;

    const hoy = new Date();
    const desde = aFechaIso(new Date(hoy.getTime() - VENTANA_ATRAS_DIAS * 86400000));
    const hasta = aFechaIso(new Date(hoy.getTime() + VENTANA_ADELANTE_DIAS * 86400000));

    const coach = events
      .filter((e) => e.workspaceId === workspaceId && e.kind === "coach" && typeof e.clientCode === "number")
      .map((e) => {
        const inicio = toDate(e.startAt);
        return {
          id: e.id,
          kind: e.kind,
          clientCode: e.clientCode ?? null,
          clientName: e.clientName ?? null,
          date: aFechaIso(inicio),
          startAt: inicio.toISOString(),
          title: e.title,
          modality: e.modality,
          done: Boolean(e.done)
        };
      })
      .filter((e) => e.date >= desde && e.date <= hasta);

    if (!coach.length) return;

    ultimoEnvio.current = ahora;
    void reportarSesionesAlErp({ workspaceId, desde, hasta, eventos: coach });
  }, [workspaceId, events, enabled]);
}
