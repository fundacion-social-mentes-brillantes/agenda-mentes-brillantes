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
/** El ERP atiende 50 códigos por consulta; con más se va por tandas. */
const CODIGOS_POR_TANDA = 50;
/**
 * Tope de seguridad. El ERP hace dos consultas por persona, así que pedir la
 * lista entera de 258 son cientos de consultas por cada carga de pantalla.
 * Quien llama debe acotar antes; esto es solo la última red.
 */
const MAX_CODIGOS = 60;

export async function consultarEstadoErp(codigos: number[]): Promise<Map<number, EstadoErp> | null> {
  const limpios = Array.from(new Set(codigos.filter((c) => Number.isFinite(c)))).slice(0, MAX_CODIGOS);
  if (!limpios.length) return new Map();

  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return null;

    const tandas: number[][] = [];
    for (let i = 0; i < limpios.length; i += CODIGOS_POR_TANDA) {
      tandas.push(limpios.slice(i, i + CODIGOS_POR_TANDA));
    }

    const mapa = new Map<number, EstadoErp>();
    for (const tanda of tandas) {
      const r = await fetch("/api/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, codigos: tanda })
      });
      // Si una tanda falla se devuelve lo que ya se tenga: media verdad del ERP
      // es mejor que ninguna, y quien no llegó se muestra con guion.
      if (!r.ok) break;

      const datos: RespuestaErp = await r.json();
      for (const p of datos.personas || []) {
        const codigo = Number(p.codigo);
        if (Number.isFinite(codigo)) mapa.set(codigo, p);
      }
    }

    return mapa.size ? mapa : null;
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

/** Lo que el ERP contesta al intentar pasar una sesión. */
export type ResultadoPaseErp =
  | { estado: "registrada"; persona: string; fecha: string; mensaje: string; paquete: string | null; coach: ResumenCupoErp }
  | { estado: "ya_estaba"; persona: string; fecha: string; mensaje: string; coach: ResumenCupoErp }
  | { estado: "sin_cupo"; persona: string; fecha: string; mensaje: string; detalle: string; coach: ResumenCupoErp }
  | { estado: "persona_desconocida"; codigo: string; mensaje: string }
  | { estado: "error"; mensaje: string };

export interface ResumenCupoErp {
  compradas: number;
  realizadas: number;
  restantes: number;
}

/**
 * Pasa una sesión coach de la agenda a la contabilidad del ERP.
 *
 * El ERP solo la descuenta de un paquete YA comprado. Si la persona no tiene
 * cupo devuelve `sin_cupo` y no escribe nada: vender el paquete es una decisión
 * de plata que se sigue tomando allá, no desde el calendario.
 *
 * A diferencia del resto del servicio, este NO es silencioso: quien oprime el
 * botón tiene que enterarse de lo que pasó.
 */
export async function pasarSesionAlErp(params: {
  codigo: number;
  fecha: string;
  eventoId: string;
}): Promise<ResultadoPaseErp> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return { estado: "error", mensaje: "Tu sesión expiró. Vuelve a iniciar sesión." };

    const r = await fetch("/api/erp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken,
        accion: "registrar-sesion",
        codigo: String(params.codigo),
        fecha: params.fecha,
        eventoId: params.eventoId
      })
    });

    const datos = await r.json().catch(() => ({}));
    if (!r.ok) return { estado: "error", mensaje: datos?.error || "No se pudo conectar con el ERP." };
    if (!datos?.estado) return { estado: "error", mensaje: "El ERP contestó algo que no se entiende." };
    return datos as ResultadoPaseErp;
  } catch {
    return { estado: "error", mensaje: "No se pudo conectar con el ERP." };
  }
}

/** Un evento coach descrito para preguntarle al ERP si ya está registrado. */
export interface EventoParaConsultar {
  id: string;
  codigo: number | null;
  fecha: string;
}

/**
 * Cuáles de estos eventos ya están registrados en el ERP, para pintarlos verdes.
 *
 * Se manda persona y fecha además del id: el ERP guarda el enlace al evento
 * solo cuando la sesión se pasó desde aquí, así que las que el dueño registra
 * directamente en el ERP solo se reconocen por persona+fecha. Sin eso, el día
 * se quedaba gris aunque la sesión sí estuviera en la contabilidad.
 *
 * Silencioso: si el ERP no responde, se devuelve vacío y todo queda gris.
 */
export async function consultarEventosEnErp(eventos: EventoParaConsultar[]): Promise<Set<string>> {
  const vistos = new Set<string>();
  const limpios = eventos
    .filter((e) => {
      if (!e?.id || vistos.has(e.id)) return false;
      vistos.add(e.id);
      return true;
    })
    .slice(0, 200);

  if (!limpios.length) return new Set();

  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return new Set();

    const r = await fetch("/api/erp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, accion: "consultar-eventos", eventos: limpios })
    });
    if (!r.ok) return new Set();

    const datos = await r.json();
    return new Set<string>(Array.isArray(datos?.registrados) ? datos.registrados : []);
  } catch {
    return new Set();
  }
}
