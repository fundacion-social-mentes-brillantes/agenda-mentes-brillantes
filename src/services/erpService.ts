import { auth } from "../lib/firebase";

/**
 * Estado real de una persona segun el ERP contable. La agenda NO guarda esto:
 * se consulta en vivo para que no existan dos contabilidades que se desvien.
 */
export interface EstadoErp {
  codigo: string;
  existe: boolean;
  nombre?: string;
  activo?: boolean;
  deuda_total?: number | null;
  total_facturado?: number | null;
  total_abonado?: number | null;
  saldo_a_favor?: number | null;
  cuentas_pendientes?: number | null;
  coach?: {
    sesiones_compradas: number;
    sesiones_realizadas: number;
    sesiones_restantes: number;
    sesiones_migradas: number;
    sesiones_tomadas_total: number;
  };
  /** false cuando la lectura quedo parcial: no mostrar la cifra como definitiva. */
  completo?: boolean;
}

export interface RespuestaErp {
  consultadas: number;
  asOf: string;
  personas: EstadoErp[];
}

/**
 * Consulta el ERP para varios codigos a la vez. Devuelve un mapa por codigo.
 * Si el ERP no responde, devuelve null: la agenda sigue funcionando igual, solo
 * que sin el dato financiero (nunca debe quedar bloqueada por el ERP).
 */
export async function consultarEstadoErp(codigos: number[]): Promise<Map<number, EstadoErp> | null> {
  const limpios = Array.from(new Set(codigos.filter((c) => Number.isFinite(c)))).slice(0, 50);
  if (!limpios.length) return new Map();

  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return null;

    const r = await fetch("/api/erp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, codigos: limpios })
    });
    if (!r.ok) return null;

    const datos: RespuestaErp = await r.json();
    const mapa = new Map<number, EstadoErp>();
    for (const p of datos.personas || []) {
      const codigo = Number(p.codigo);
      if (Number.isFinite(codigo)) mapa.set(codigo, p);
    }
    return mapa;
  } catch {
    return null;
  }
}

export function formatearPesos(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return `$${Math.round(valor).toLocaleString("es-CO")}`;
}

/**
 * Le cuenta al ERP que sesiones coach hay en la agenda dentro de una ventana.
 *
 * NO cambia nada en la contabilidad: el ERP solo lo usa para comparar y avisarle
 * al dueño de las diferencias (sesiones que ya pasaron sin registrar, fechas
 * movidas, eventos borrados que ya estaban cobrados). Quien decide que se
 * registra es una persona, desde el ERP.
 *
 * Silencioso a proposito: si el ERP no responde, la agenda no se entera y sigue
 * funcionando igual.
 */
export async function reportarSesionesAlErp(params: {
  workspaceId: string;
  desde: string;
  hasta: string;
  eventos: Array<{
    id?: string;
    kind?: string;
    clientCode?: number | null;
    clientName?: string | null;
    date?: string;
    startAt?: unknown;
    title?: string;
    modality?: string;
    done?: boolean;
  }>;
}): Promise<{ diferencias: number } | null> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return null;

    const r = await fetch("/api/erp-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, ...params })
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Fecha en formato AAAA-MM-DD. */
export function aFechaIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
