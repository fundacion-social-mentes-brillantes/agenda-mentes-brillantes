import { useCallback, useEffect, useRef, useState } from "react";
import { consultarEstadoErp, type EstadoErp } from "../services/erpService";

/**
 * Trae del ERP el estado real (deuda y sesiones coach) de las personas
 * indicadas. Se consulta en vivo y NO se guarda en la agenda: la contabilidad
 * tiene un solo dueño, el ERP.
 *
 * Si el ERP no responde, `estados` queda vacio y `erpCaido` en true: la agenda
 * sigue funcionando igual, solo sin el dato financiero.
 */
export function useEstadoErp(codigos: number[], enabled = true) {
  const [estados, setEstados] = useState<Map<number, EstadoErp>>(new Map());
  const [cargando, setCargando] = useState(false);
  const [erpCaido, setErpCaido] = useState(false);
  const [recargas, setRecargas] = useState(0);

  // Clave estable: evita repetir la consulta cuando el array cambia de
  // identidad pero trae los mismos codigos (pasa en cada render del calendario).
  const clave = Array.from(new Set(codigos.filter(Number.isFinite))).sort((a, b) => a - b).join(",");
  const ultimaClave = useRef<string>("");

  useEffect(() => {
    if (!enabled || !clave) {
      setEstados(new Map());
      return;
    }

    let cancelado = false;
    ultimaClave.current = clave;
    setCargando(true);

    consultarEstadoErp(clave.split(",").map(Number))
      .then((mapa) => {
        if (cancelado) return;
        if (mapa === null) {
          setErpCaido(true);
          setEstados(new Map());
        } else {
          setErpCaido(false);
          setEstados(mapa);
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [clave, enabled, recargas]);

  const recargar = useCallback(() => setRecargas((n) => n + 1), []);

  return { estados, cargando, erpCaido, recargar };
}
