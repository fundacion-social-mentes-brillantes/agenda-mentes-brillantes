import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudUpload, Layers } from "lucide-react";
import { Spinner } from "../ui/Spinner";
import type { CalendarEvent } from "../../types/event";
import { toDate } from "../../lib/dateUtils";
import {
  aFechaIso,
  consultarEventosEnErp,
  pasarSesionAlErp,
  type ResultadoPaseErp,
  type ResumenCupoErp
} from "../../services/erpService";
import { useEstadoErp } from "../../hooks/useEstadoErp";

/**
 * Botón para pasar una sesión coach de la agenda a la contabilidad del ERP.
 *
 * Sale gris (neutro) mientras la sesión no esté en el ERP, y se pone verde
 * cuando ya está: así se ve de un vistazo qué falta por pasar. Pide
 * confirmación antes de escribir, porque esto sí toca la contabilidad.
 *
 * El cupo que muestra viene del ERP en vivo, no de los contadores propios de la
 * agenda: si la persona no tiene sesiones compradas, el ERP dice que no y aquí
 * se muestra tal cual, sin registrar nada.
 */
export function PasarAlErpBoton({ event }: { event: CalendarEvent }) {
  const [paso, setPaso] = useState<"revisando" | "listo" | "confirmando" | "enviando" | "resuelto">("revisando");
  const [resultado, setResultado] = useState<ResultadoPaseErp | null>(null);

  const codigo = typeof event.clientCode === "number" ? event.clientCode : null;
  const fecha = aFechaIso(toDate(event.startAt));
  const esCoach = event.kind === "coach" && codigo !== null;

  // El endpoint de personas nombra los campos distinto al de registrar; se
  // traducen aqui para que el resto del componente vea una sola forma.
  const { estados } = useEstadoErp(codigo === null ? [] : [codigo], esCoach);
  const coachErp = codigo === null ? undefined : estados.get(codigo)?.coach;
  const cupoErp: ResumenCupoErp | undefined = coachErp
    ? {
        compradas: coachErp.sesiones_compradas,
        realizadas: coachErp.sesiones_realizadas,
        restantes: coachErp.sesiones_restantes
      }
    : undefined;

  // Al abrir el evento se pregunta si esa sesión ya está en la contabilidad.
  useEffect(() => {
    if (!esCoach || !event.id) return;

    let cancelado = false;
    setPaso("revisando");
    setResultado(null);

    consultarEventosEnErp([{ id: event.id, codigo, fecha }]).then((registrados) => {
      if (cancelado) return;
      setPaso(registrados.has(event.id as string) ? "resuelto" : "listo");
    });

    return () => {
      cancelado = true;
    };
  }, [event.id, esCoach, codigo, fecha]);

  if (!esCoach || !event.id) return null;

  const pasar = async () => {
    setPaso("enviando");
    const r = await pasarSesionAlErp({ codigo, fecha, eventoId: event.id as string });
    setResultado(r);
    // Si no hay cupo se puede volver a intentar cuando le vendan el paquete;
    // si quedó registrada, ya no hay nada que oprimir.
    setPaso(r.estado === "registrada" || r.estado === "ya_estaba" ? "resuelto" : "listo");
  };

  const cupo = (resultado && "coach" in resultado ? resultado.coach : undefined) || cupoErp;
  const registrada = paso === "resuelto";

  return (
    <div className="rounded-2xl border border-app-soft bg-app-soft p-4">
      <p className="m-0 mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-app-faint">
        <Layers size={13} />
        Contabilidad (ERP)
      </p>

      {cupo && <Cupo cupo={cupo} />}

      {resultado && resultado.estado === "sin_cupo" && (
        <Aviso tono="alerta" icono={<AlertTriangle size={17} />} titulo={resultado.mensaje} detalle={resultado.detalle} />
      )}
      {resultado && resultado.estado === "persona_desconocida" && (
        <Aviso tono="alerta" icono={<AlertTriangle size={17} />} titulo={resultado.mensaje} />
      )}
      {resultado && resultado.estado === "error" && (
        <Aviso tono="alerta" icono={<AlertTriangle size={17} />} titulo={resultado.mensaje} />
      )}
      {registrada && (
        <Aviso
          tono="ok"
          icono={<CheckCircle2 size={17} />}
          titulo={resultado && "mensaje" in resultado ? resultado.mensaje : "Esta sesión ya está en el ERP."}
        />
      )}

      {!registrada && paso !== "revisando" && (
        <>
          {paso === "confirmando" ? (
            <div className="mt-3 space-y-3">
              <p className="m-0 text-sm font-bold text-app-strong">
                ¿Seguro que quieres pasar esta sesión al ERP?
              </p>
              <p className="m-0 text-xs text-app-faint">
                Se le descontará una sesión del paquete a {event.clientName || "la persona"}, con fecha {fecha}. Esto
                toca la contabilidad.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={pasar} className="btn-primary flex-1">
                  Sí, pasarla al ERP
                </button>
                <button type="button" onClick={() => setPaso("listo")} className="btn-secondary flex-1">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPaso("confirmando")}
              disabled={paso === "enviando"}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-app-soft bg-app-panel px-4 py-3 text-sm font-bold text-app-muted transition hover:text-app-strong disabled:opacity-60"
            >
              {paso === "enviando" ? <Spinner className="h-5 w-5" /> : <CloudUpload size={17} />}
              {paso === "enviando" ? "Pasando…" : "Pasar al ERP"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Cupo({ cupo }: { cupo: ResumenCupoErp }) {
  const sinCupo = cupo.restantes <= 0;
  return (
    <div className="grid grid-cols-3 gap-2">
      <Dato label="Compradas" valor={cupo.compradas} />
      <Dato label="Tomadas" valor={cupo.realizadas} />
      <Dato label="Disponibles" valor={cupo.restantes} alerta={sinCupo} />
    </div>
  );
}

function Dato({ label, valor, alerta }: { label: string; valor: number; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-app-soft bg-app-panel p-2 text-center">
      <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-app-faint">{label}</p>
      <p className={`m-0 mt-0.5 text-lg font-black ${alerta ? "text-red-500" : "text-app-strong"}`}>{valor}</p>
    </div>
  );
}

function Aviso({
  tono,
  icono,
  titulo,
  detalle
}: {
  tono: "ok" | "alerta";
  icono: React.ReactNode;
  titulo: string;
  detalle?: string;
}) {
  const estilo =
    tono === "ok"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600"
      : "border-amber-500/30 bg-amber-500/10 text-amber-600";

  return (
    <div className={`mt-3 flex items-start gap-2 rounded-2xl border p-3 ${estilo}`}>
      <span className="mt-0.5 shrink-0">{icono}</span>
      <div className="min-w-0">
        <p className="m-0 text-sm font-bold">{titulo}</p>
        {detalle && <p className="m-0 mt-1 text-xs font-semibold opacity-90">{detalle}</p>}
      </div>
    </div>
  );
}
