import { useCallback, useEffect, useState } from "react";
import { consultarEventosEnErp } from "../services/erpService";
import type { CalendarEvent } from "../types/event";
import { toDate } from "../lib/dateUtils";
import { aFechaIso } from "../services/erpService";

/**
 * Cuáles de las sesiones coach visibles ya están registradas en la contabilidad.
 *
 * Se pregunta por TODAS de una sola vez (el ERP acepta hasta 200 por consulta),
 * no de a una al abrir cada evento: la idea es poder mirar el calendario y ver
 * de un vistazo qué falta por pasar al ERP, sin abrir nada.
 *
 * Si el ERP no responde, el conjunto queda vacío y todo se ve gris. La agenda
 * nunca se bloquea por esto.
 */
export function useEventosEnErp(events: CalendarEvent[], enabled = true) {
  const [registrados, setRegistrados] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(false);
  const [recargas, setRecargas] = useState(0);

  // Solo sesiones coach con persona: el resto del calendario no es contabilidad.
  const coach = events
    .filter((e) => e.id && e.kind === "coach" && typeof e.clientCode === "number")
    .map((e) => ({ id: e.id as string, codigo: e.clientCode as number, fecha: aFechaIso(toDate(e.startAt)) }));

  // Clave estable: el array cambia de identidad en cada render del calendario
  // aunque traiga exactamente los mismos eventos.
  const clave = coach
    .map((e) => `${e.id}:${e.fecha}`)
    .sort()
    .join(",");

  useEffect(() => {
    if (!enabled || !clave) {
      setRegistrados(new Set());
      return;
    }

    let cancelado = false;
    setCargando(true);

    consultarEventosEnErp(coach)
      .then((mapa) => {
        if (!cancelado) setRegistrados(mapa);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
    // `coach` se reconstruye en cada render; la dependencia real es `clave`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, enabled, recargas]);

  const recargar = useCallback(() => setRecargas((n) => n + 1), []);

  return { registrados, cargando, recargar };
}
