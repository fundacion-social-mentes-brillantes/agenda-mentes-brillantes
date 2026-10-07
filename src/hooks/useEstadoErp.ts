import { useCallback, useEffect, useState } from "react";
import { consultarEstadoErp, type EstadoErp } from "../services/erpService";

/**
 * Trae del ERP el estado real (deuda y sesiones coach) de las personas
 * indicadas. Se consulta en vivo y NO se guarda en la agenda: la contabilidad
 * tiene un solo dueño, el ERP.
 *
 * Si el ERP no responde, `estados` queda vacio y `erpCaido` en true: la agenda
 * sigue funcionando igual, solo sin el dato financiero.
 */
const SIN_DATOS: Map<number, EstadoErp> = new Map();

export function useEstadoErp(codigos: number[], enabled = true) {
  const [recargas, setRecargas] = useState(0);
  // La ultima respuesta del ERP con la consulta a la que pertenece. "Cargando"
  // es que aun no llega la de la consulta actual: el efecto no pone estados a
  // mano. Mientras carga se siguen mostrando los datos anteriores.
  const [respuesta, setRespuesta] = useState<{
    clave: string;
    recarga: number;
    estados: Map<number, EstadoErp>;
    erpCaido: boolean;
  } | null>(null);

  // Clave estable: evita repetir la consulta cuando el array cambia de
  // identidad pero trae los mismos codigos (pasa en cada render del calendario).
  const clave = Array.from(new Set(codigos.filter(Number.isFinite))).sort((a, b) => a - b).join(",");
  const activo = enabled && Boolean(clave);

  useEffect(() => {
    if (!activo) return;

    let cancelado = false;
    consultarEstadoErp(clave.split(",").map(Number))
      .catch(() => null)
      .then((mapa) => {
        if (cancelado) return;
        setRespuesta({ clave, recarga: recargas, estados: mapa ?? new Map(), erpCaido: mapa === null });
      });

    return () => {
      cancelado = true;
    };
  }, [clave, activo, recargas]);

  const recargar = useCallback(() => setRecargas((n) => n + 1), []);

  const alDia = respuesta?.clave === clave && respuesta.recarga === recargas;
  return {
    estados: activo ? respuesta?.estados ?? SIN_DATOS : SIN_DATOS,
    cargando: activo && !alDia,
    erpCaido: activo ? Boolean(respuesta?.erpCaido) : false,
    recargar
  };
}
