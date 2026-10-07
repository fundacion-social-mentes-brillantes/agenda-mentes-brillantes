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
const NINGUNO: Set<string> = new Set();

export function useEventosEnErp(events: CalendarEvent[], enabled = true) {
  const [recargas, setRecargas] = useState(0);
  // Ultima respuesta del ERP con la consulta a la que pertenece; "cargando" es
  // que aun no llega la de la consulta actual (el efecto no pone estados a mano).
  const [respuesta, setRespuesta] = useState<{ clave: string; recarga: number; registrados: Set<string> } | null>(null);

  // Solo sesiones coach con persona: el resto del calendario no es contabilidad.
  // Clave estable (id|codigo|fecha): el array de eventos cambia de identidad en
  // cada render aunque traiga lo mismo. La consulta se arma desde la clave, asi
  // el efecto depende solo de ella.
  const clave = events
    .filter((e) => e.id && e.kind === "coach" && typeof e.clientCode === "number")
    .map((e) => `${e.id}|${e.clientCode}|${aFechaIso(toDate(e.startAt))}`)
    .sort()
    .join(",");
  const activo = enabled && Boolean(clave);

  useEffect(() => {
    if (!activo) return;

    const consulta = clave.split(",").map((parte) => {
      const [id, codigo, fecha] = parte.split("|");
      return { id, codigo: Number(codigo), fecha };
    });

    let cancelado = false;
    consultarEventosEnErp(consulta)
      .catch(() => new Set<string>())
      .then((registrados) => {
        if (!cancelado) setRespuesta({ clave, recarga: recargas, registrados });
      });

    return () => {
      cancelado = true;
    };
  }, [clave, activo, recargas]);

  const recargar = useCallback(() => setRecargas((n) => n + 1), []);

  const alDia = respuesta?.clave === clave && respuesta.recarga === recargas;
  return {
    registrados: activo ? respuesta?.registrados ?? NINGUNO : NINGUNO,
    cargando: activo && !alDia,
    recargar
  };
}
