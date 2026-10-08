import type React from "react";
import { CheckCircle2, HeartHandshake, MapPin, Paperclip, Video } from "lucide-react";
import { formatCOP, toDate } from "../../lib/dateUtils";
import type { CalendarEvent } from "../../types/event";

// Una cita en una sola fila compacta: así caben todas las del día en la pantalla
// del celular sin tener que bajar. La usan el calendario, "Hoy" y la agenda completa.

// Se puede arrastrar manteniendo presionada: sin menú del sistema ni selección de
// texto, y la lista sigue bajando con el dedo mientras no se haya activado el arrastre.
const ARRASTRABLE: React.CSSProperties = { touchAction: "pan-y", WebkitTouchCallout: "none" };

function hora(fecha: Date): string {
  return fecha.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true });
}

interface FilaEventoProps {
  event: CalendarEvent;
  onClick: () => void;
  /** Sesión coach que ya está en la contabilidad (marca verde). */
  enErp?: boolean;
  /** Momento de referencia para atenuar lo que ya pasó y marcar lo que está pasando. */
  ahora?: Date;
  /** Para arrastrar la cita a otro día del calendario (mantener presionado). */
  onPointerDown?: (e: React.PointerEvent) => void;
  arrastrando?: boolean;
}

export function FilaEvento({ event, onClick, enErp = false, ahora, onPointerDown, arrastrando = false }: FilaEventoProps) {
  const inicio = toDate(event.startAt);
  const fin = toDate(event.endAt);
  const yaPaso = ahora ? fin.getTime() < ahora.getTime() : false;
  const enCurso = ahora ? !event.allDay && inicio.getTime() <= ahora.getTime() && fin.getTime() >= ahora.getTime() : false;
  const esCoach = event.kind === "coach";
  const adjuntos = (event.attachments?.length || 0) + (event.imageUrl ? 1 : 0);
  const valor = typeof event.totalAmount === "number" ? formatCOP(event.totalAmount) : "";

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      style={onPointerDown ? ARRASTRABLE : undefined}
      className={`group flex w-full select-none items-stretch gap-2.5 rounded-2xl border border-app-soft bg-app-panel py-1.5 pl-2 pr-3 text-left transition hover:bg-app-soft ${
        yaPaso && !enCurso ? "opacity-60" : ""
      } ${arrastrando ? "opacity-40" : ""} ${enCurso ? "ring-1 ring-[color:var(--app-accent)]" : ""}`}
    >
      <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: event.color }} aria-hidden="true" />

      <span className="flex w-[4.25rem] shrink-0 flex-col justify-center">
        {event.allDay ? (
          <span className="text-[11px] font-black leading-tight text-app-muted">Todo el día</span>
        ) : (
          <>
            <span className="text-[13px] font-black leading-tight text-app-strong">{hora(inicio)}</span>
            <span className="text-[11px] leading-tight text-app-faint">{hora(fin)}</span>
          </>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center">
        <span className={`truncate text-sm font-bold leading-snug text-app-strong ${event.done ? "line-through opacity-70" : ""}`}>
          {event.title}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] font-semibold leading-tight text-app-faint">
          {enCurso && <span className="shrink-0 rounded-full bg-app-soft px-1.5 font-black text-app-accent">Ahora</span>}
          {esCoach && (
            <span className="inline-flex shrink-0 items-center gap-0.5">
              <HeartHandshake size={11} /> Coach
            </span>
          )}
          {event.modality === "virtual" && (
            <span className="inline-flex shrink-0 items-center gap-0.5">
              <Video size={11} /> Virtual
            </span>
          )}
          {event.modality === "presencial" && (
            <span className="inline-flex shrink-0 items-center gap-0.5">
              <MapPin size={11} /> Presencial
            </span>
          )}
          {valor && <span className="truncate">{valor}</span>}
          {adjuntos > 0 && <Paperclip size={11} className="shrink-0" aria-label="Tiene adjuntos" />}
        </span>
      </span>

      {esCoach && enErp && (
        <span className="flex shrink-0 items-center" title="Ya está en el ERP">
          <CheckCircle2 size={16} className="text-emerald-500" aria-label="Ya está en el ERP" />
        </span>
      )}
    </button>
  );
}
