import { useMemo, useRef, useState } from "react";
import type React from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, HeartHandshake, Plus, Sparkles } from "lucide-react";
import { EventDetailModal } from "../components/events/EventDetailModal";
import { FilaEvento } from "../components/events/FilaEvento";
import { isSameDay, startOfDay, toDate } from "../lib/dateUtils";
import { useEventosEnErp } from "../hooks/useEventosEnErp";
import type { CalendarEvent } from "../types/event";

interface CalendarPageProps {
  events: CalendarEvent[];
  setActivePage: (page: string) => void;
  setEditingEvent: (event: CalendarEvent | null) => void;
  setSelectedDate: (date: Date) => void;
  onDuplicate: (event: CalendarEvent, dates: string[]) => Promise<void>;
  onUpdateEvent: (id: string, eventData: Partial<CalendarEvent>) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Marcas de color que caben debajo de cada día en el celular (como rayitas).
const MARCAS_POR_DIA = 3;
// Fichas con el título que caben en cada día en el computador (la cuarta ya salía cortada).
const FICHAS_POR_DIA = 3;

/**
 * Calendario: arriba el mes y abajo (a la derecha en el computador) el día elegido
 * con todas sus citas en filas compactas. Al abrir, el día elegido es HOY.
 */
export default function CalendarPage({
  events,
  setActivePage,
  setEditingEvent,
  setSelectedDate,
  onDuplicate,
  onUpdateEvent,
  onDeleteEvent
}: CalendarPageProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [diaElegido, setDiaElegido] = useState(() => startOfDay(new Date()));
  // Filtro del calendario: "todo" (por defecto) o solo las sesiones coach.
  const [filter, setFilter] = useState<"all" | "coach">("all");
  const soloCoach = filter === "coach";
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [drag, setDrag] = useState<{ event: CalendarEvent; x: number; y: number; overKey: string | null } | null>(null);
  const didDragRef = useRef(false);

  // Qué sesiones coach ya están en la contabilidad, para verlo sin abrir nada.
  const { registrados: enErp } = useEventosEnErp(events);
  const estaEnErp = (event: CalendarEvent) => Boolean(event.id && enErp.has(event.id));
  const esCoach = (event: CalendarEvent) => event.kind === "coach" && typeof event.clientCode === "number";

  const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Cambiar de mes: si el mes nuevo es el de hoy se elige hoy; si no, el día 1.
  const irAMes = (anio: number, mes: number) => {
    const primero = new Date(anio, mes, 1);
    const hoy = new Date();
    setCurrentDate(primero);
    setDiaElegido(primero.getFullYear() === hoy.getFullYear() && primero.getMonth() === hoy.getMonth() ? startOfDay(hoy) : primero);
  };

  const irAHoy = () => {
    const hoy = new Date();
    setCurrentDate(hoy);
    setDiaElegido(startOfDay(hoy));
  };

  // Tocar un día del mes vecino (los grises de los bordes) lleva a ese mes.
  const elegirDia = (date: Date) => {
    setDiaElegido(startOfDay(date));
    if (date.getMonth() !== month || date.getFullYear() !== year) setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const moveEventToKey = (event: CalendarEvent, key: string) => {
    const s = toDate(event.startAt);
    const e = toDate(event.endAt);
    const dur = Math.max(0, e.getTime() - s.getTime());
    const [y, m, dd] = key.split("-").map(Number);
    const ns = new Date(y, m - 1, dd, s.getHours(), s.getMinutes(), 0, 0);
    const ne = new Date(ns.getTime() + dur);
    if (event.id) void onUpdateEvent(event.id, { startAt: ns, endAt: ne });
  };

  // Mantener presionada una cita (en el mes o en la lista del día) y soltarla en
  // otro día la mueve a ese día, con la misma hora.
  const startChipDrag = (e: React.PointerEvent, event: CalendarEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    // Mientras se arrastra, el dedo no debe hacer scroll de la lista.
    const sinScroll = (ev: TouchEvent) => {
      if (active && ev.cancelable) ev.preventDefault();
    };
    const timer = window.setTimeout(() => {
      active = true;
      setDrag({ event, x: startX, y: startY, overKey: null });
      if (navigator.vibrate) navigator.vibrate(20);
    }, 320);

    const move = (ev: PointerEvent) => {
      if (!active) {
        if (Math.abs(ev.clientX - startX) > 8 || Math.abs(ev.clientY - startY) > 8) {
          window.clearTimeout(timer);
          cleanup();
        }
        return;
      }
      ev.preventDefault();
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const cell = el?.closest("[data-daykey]") as HTMLElement | null;
      const overKey = cell?.getAttribute("data-daykey") || null;
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY, overKey } : d));
    };
    const up = (ev: PointerEvent) => {
      window.clearTimeout(timer);
      cleanup();
      if (active) {
        const el = ev.type === "pointercancel" ? null : (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null);
        const cell = el?.closest("[data-daykey]") as HTMLElement | null;
        const overKey = cell?.getAttribute("data-daykey") || null;
        if (overKey && overKey !== dateKey(toDate(event.startAt))) moveEventToKey(event, overKey);
        didDragRef.current = true;
        window.setTimeout(() => {
          didDragRef.current = false;
        }, 60);
        setDrag(null);
      }
    };
    function cleanup() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", sinScroll);
    }
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("touchmove", sinScroll, { passive: false });
  };

  const { gridCells, weeks } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    let startIndex = firstDay.getDay() - 1;
    if (startIndex === -1) startIndex = 6;
    const prevMonthDays = new Date(year, month, 0).getDate();
    const currentMonthDays = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date; currentMonth: boolean }[] = [];

    for (let i = startIndex - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, prevMonthDays - i), currentMonth: false });
    }
    for (let day = 1; day <= currentMonthDays; day++) {
      cells.push({ date: new Date(year, month, day), currentMonth: true });
    }
    while (cells.length < 42) {
      cells.push({ date: new Date(year, month + 1, cells.length - startIndex - currentMonthDays + 1), currentMonth: false });
    }
    // Semanas reales del mes (5 casi siempre): en el celular solo se muestran esas,
    // para que quede espacio a la lista del día. En el computador se ven las 6 filas.
    return { gridCells: cells, weeks: Math.ceil((startIndex + currentMonthDays) / 7) };
  }, [month, year]);

  // Deslizar a los lados (solo táctil) sobre el mes para cambiar de mes.
  const touchSwipeRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchSwipeRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchSwipeRef.current;
    touchSwipeRef.current = null;
    if (!start || drag || didDragRef.current) return; // no cambiar de mes si se estaba arrastrando un evento
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.8 * Math.abs(dy)) {
      irAMes(year, month + (dx < 0 ? 1 : -1));
    }
  };

  // Todos los eventos por día. Se agrupan todos (no solo los del mes a la vista)
  // porque el día elegido puede ser de cualquier mes.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      // Con el filtro en "Sesiones coach" el resto de la agenda no se dibuja.
      if (soloCoach && event.kind !== "coach") continue;
      const d = toDate(event.startAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) || [];
      list.push(event);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime());
    return map;
  }, [events, soloCoach]);

  const getEventsForDay = (date: Date) => eventsByDay.get(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`) || [];

  // Cuántas hay en el mes y cuántas en lo que el celular dibuja (sin la 6ª fila).
  const { visiblesEnMes, visiblesEnCelular, visiblesEnPantalla } = useMemo(() => {
    let enMes = 0;
    let enCelular = 0;
    let enPantalla = 0;
    gridCells.forEach(({ date }, index) => {
      const cantidad = (eventsByDay.get(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`) || []).length;
      enPantalla += cantidad;
      if (index < weeks * 7) enCelular += cantidad;
      if (date.getMonth() === month && date.getFullYear() === year) enMes += cantidad;
    });
    return { visiblesEnMes: enMes, visiblesEnCelular: enCelular, visiblesEnPantalla: enPantalla };
  }, [eventsByDay, gridCells, weeks, month, year]);

  const ahora = new Date();
  const eventosDelDia = getEventsForDay(diaElegido);
  const elegidoEsHoy = isSameDay(diaElegido, ahora);

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedEvent(null);
    setActivePage("event-form");
  };

  const handleCreateForDay = (date: Date) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setActivePage("event-form");
  };

  const abrirEvento = (event: CalendarEvent) => {
    if (didDragRef.current) return;
    setSelectedEvent(event);
  };

  return (
    // Alto exacto de la pantalla menos el encabezado, los márgenes y la barra de abajo:
    // así el mes y el día se ven completos sin que la página se mueva.
    <div className="-mx-4 flex h-[calc(100dvh-12.125rem-env(safe-area-inset-top))] flex-col gap-2 sm:mx-0 md:h-[calc(100dvh-6rem)] lg:flex-row lg:gap-5">
      {/* ---------- El mes ---------- */}
      <section className="flex shrink-0 flex-col gap-2 px-3 sm:px-0 lg:min-h-0 lg:min-w-0 lg:flex-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-xl font-black tracking-tight text-app-strong sm:text-2xl">
            {MONTHS[month]} <span className="font-bold text-app-faint">{year}</span>
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => irAMes(year, month - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-app-soft bg-app-soft text-app-accent transition hover:bg-app-panel"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={irAHoy} className="btn-secondary min-h-9 rounded-full px-3.5 py-1.5 text-xs">
              Hoy
            </button>
            <button
              type="button"
              onClick={() => irAMes(year, month + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-app-soft bg-app-soft text-app-accent transition hover:bg-app-panel"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={18} />
            </button>
            {/* Celular: el filtro de sesiones coach es este botón, para que el mes ocupe
                menos y quepan más citas del día. En el computador va la fila completa. */}
            <button
              type="button"
              onClick={() => setFilter(soloCoach ? "all" : "coach")}
              aria-pressed={soloCoach}
              aria-label={soloCoach ? "Ver toda la agenda" : "Ver solo sesiones coach"}
              title={soloCoach ? "Ver toda la agenda" : "Ver solo sesiones coach"}
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition lg:hidden ${
                soloCoach ? "accent-gradient border-transparent shadow-sm" : "border-app-soft bg-app-soft text-app-accent"
              }`}
            >
              <HeartHandshake size={17} />
            </button>
          </div>
        </div>

        {soloCoach && (
          <p className="m-0 flex items-center gap-1.5 text-[11px] font-bold text-app-faint lg:hidden">
            <HeartHandshake size={12} className="text-app-accent" />
            {visiblesEnMes === 0
              ? `Solo sesiones coach: no hay en ${MONTHS[month].toLowerCase()}`
              : `Solo sesiones coach: ${visiblesEnMes} en ${MONTHS[month].toLowerCase()}`}
          </p>
        )}

        <div className="hidden items-center gap-2 lg:flex">
          <div className="flex gap-1 rounded-2xl border border-app-soft bg-app-soft p-1" role="group" aria-label="Filtrar calendario">
            <button
              type="button"
              onClick={() => setFilter("all")}
              aria-pressed={!soloCoach}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${!soloCoach ? "bg-app-panel text-app-accent shadow-sm" : "text-app-muted"}`}
            >
              Todo
            </button>
            <button
              type="button"
              onClick={() => setFilter("coach")}
              aria-pressed={soloCoach}
              className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition ${soloCoach ? "bg-app-panel text-app-accent shadow-sm" : "text-app-muted"}`}
            >
              <HeartHandshake size={13} />
              Sesiones coach
            </button>
          </div>
          {/* Se muestra también en cero: si el mes está vacío pero asoman marcas de los
              días vecinos, esta línea es la que lo explica. */}
          {soloCoach && (
            <span className="min-w-0 truncate text-[11px] font-bold text-app-faint">
              {visiblesEnMes === 0
                ? `Sin sesiones en ${MONTHS[month].toLowerCase()}`
                : `${visiblesEnMes} ${visiblesEnMes === 1 ? "sesión" : "sesiones"} en ${MONTHS[month].toLowerCase()}`}
            </span>
          )}
        </div>

        <div
          className="relative flex flex-col rounded-3xl border border-app-soft bg-app-panel p-2 shadow-sm lg:min-h-0 lg:flex-1 lg:p-3"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="mb-1 grid grid-cols-7">
            {DAYS.map((day) => (
              <span key={day} className="py-1 text-center text-[10px] font-black uppercase text-app-faint sm:text-xs">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 lg:min-h-0 lg:flex-1 lg:auto-rows-fr lg:grid-rows-6 lg:gap-1">
            {gridCells.map(({ date, currentMonth }, index) => {
              const dayEvents = getEventsForDay(date);
              const today = isSameDay(date, ahora);
              const elegido = isSameDay(date, diaElegido);
              // En el celular solo se muestran las semanas del mes; en el computador siempre 6 filas.
              const beyondMonth = index >= weeks * 7;
              const encima = drag && drag.overKey === dateKey(date);
              // Si no caben todas, se deja el último renglón para el "+N más" (si no, salía cortado).
              const fichas = dayEvents.length > FICHAS_POR_DIA ? FICHAS_POR_DIA - 1 : FICHAS_POR_DIA;

              return (
                <button
                  key={`${date.toISOString()}-${index}`}
                  type="button"
                  data-daykey={dateKey(date)}
                  onClick={() => {
                    if (didDragRef.current) return;
                    elegirDia(date);
                  }}
                  aria-pressed={elegido}
                  aria-label={`${date.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}${
                    dayEvents.length ? `, ${dayEvents.length} ${dayEvents.length === 1 ? "cita" : "citas"}` : ""
                  }`}
                  className={`${beyondMonth ? "hidden lg:flex" : "flex"} h-10 min-h-0 flex-col items-center rounded-2xl pt-0.5 transition lg:h-auto lg:items-stretch lg:overflow-hidden lg:border lg:p-1 lg:text-left ${
                    encima
                      ? "bg-app-soft ring-2 ring-[color:var(--app-accent)] lg:border-app-accent"
                      : elegido
                        ? "lg:border-app-accent lg:bg-app-soft"
                        : "lg:border-app-soft lg:hover:bg-app-soft"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-black lg:mb-0.5 lg:h-6 lg:w-6 lg:text-xs ${
                      elegido ? "cal-dia--elegido" : today ? "cal-dia--hoy" : currentMonth ? "text-app-strong" : "text-app-faint opacity-60"
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  {/* Celular: rayitas de color, una por cita (hasta 3). */}
                  <span className="mt-0.5 flex h-1 items-center gap-0.5 lg:hidden" aria-hidden="true">
                    {dayEvents.slice(0, MARCAS_POR_DIA).map((event) => (
                      <span key={event.id} className="h-1 w-2.5 rounded-full" style={{ backgroundColor: event.color }} />
                    ))}
                    {dayEvents.length > MARCAS_POR_DIA && <span className="h-1 w-1 rounded-full bg-[color:var(--app-faint)]" />}
                  </span>

                  {/* Computador: fichas con el título, que se pueden arrastrar a otro día. */}
                  <span className="hidden flex-1 space-y-0.5 overflow-hidden lg:block">
                    {dayEvents.slice(0, fichas).map((event) => {
                      // Solo las sesiones coach se marcan: el resto del calendario
                      // no tiene nada que ver con la contabilidad.
                      const yaEnErp = esCoach(event) && estaEnErp(event);
                      return (
                        <span
                          key={event.id}
                          title={yaEnErp ? `${event.title} — ya está en el ERP` : event.title}
                          onPointerDown={(e) => startChipDrag(e, event)}
                          className={`block truncate rounded-md px-1.5 py-0 text-[10px] font-semibold leading-4 text-white ${
                            drag?.event.id === event.id ? "opacity-40" : ""
                          } ${yaEnErp ? "ring-1 ring-emerald-300" : ""}`}
                          style={{ backgroundColor: event.color, touchAction: "none" }}
                        >
                          {yaEnErp && <span className="mr-0.5 font-black text-emerald-200">✓</span>}
                          {event.title}
                        </span>
                      );
                    })}
                    {dayEvents.length > fichas && (
                      <span className="block px-1 text-[10px] font-black text-app-faint">+{dayEvents.length - fichas} más</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Aviso DENTRO del mes: filtrando sesiones coach y no hay NADA dibujado.
              En el celular cuenta sin la 6ª fila (oculta); en el computador, con ella. */}
          {soloCoach && visiblesEnCelular === 0 && (
            <div
              role="status"
              className={`pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-6 ${
                visiblesEnPantalla > 0 ? "lg:hidden" : ""
              }`}
            >
              <p className="m-0 rounded-2xl border border-app-soft bg-app-solid px-4 py-3 text-center text-sm font-black text-app-muted shadow-lg">
                No hay sesiones coach en {MONTHS[month].toLowerCase()}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ---------- El día elegido ---------- */}
      <section className="flex min-h-0 flex-1 flex-col gap-2 px-3 sm:px-0 lg:w-[22rem] lg:flex-none xl:w-[24rem]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 truncate text-base font-black text-app-strong">
              {capitalize(diaElegido.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }))}
            </p>
            <p className="m-0 text-xs font-semibold text-app-faint">
              {elegidoEsHoy ? "Hoy · " : ""}
              {eventosDelDia.length === 0
                ? soloCoach
                  ? "Sin sesiones coach"
                  : "Nada agendado"
                : `${eventosDelDia.length} ${soloCoach ? (eventosDelDia.length === 1 ? "sesión" : "sesiones") : eventosDelDia.length === 1 ? "cita" : "citas"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleCreateForDay(diaElegido)}
            className="btn-primary h-10 min-h-10 w-10 shrink-0 rounded-full p-0"
            aria-label="Crear evento este día"
            title="Crear evento este día"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Abajo queda espacio para el botón del asistente (celular): la última cita se puede subir y leer completa. */}
        <div className="app-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-20 lg:pb-2 lg:pr-1">
          {eventosDelDia.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-app-soft px-4 py-8 text-center">
              <Sparkles size={28} className="mb-2 text-app-accent" />
              <p className="m-0 text-sm font-black text-app-strong">{soloCoach ? "No hay sesiones coach este día" : "Día libre"}</p>
              {soloCoach && <p className="m-0 mt-1 text-xs font-semibold text-app-faint">El filtro está en “Sesiones coach”.</p>}
              <button type="button" onClick={() => handleCreateForDay(diaElegido)} className="btn-secondary mt-4 min-h-9 py-1.5 text-xs">
                <CalendarPlus size={15} />
                Crear evento este día
              </button>
            </div>
          ) : (
            eventosDelDia.map((event) => (
              <FilaEvento
                key={event.id}
                event={event}
                enErp={esCoach(event) && estaEnErp(event)}
                ahora={elegidoEsHoy ? ahora : undefined}
                onClick={() => abrirEvento(event)}
                onPointerDown={(e) => startChipDrag(e, event)}
                arrastrando={drag?.event.id === event.id}
              />
            ))
          )}
        </div>
      </section>

      <EventDetailModal
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onEdit={handleEdit}
        onDuplicate={onDuplicate}
        onDeleteEvent={onDeleteEvent}
      />

      {drag && (
        <div
          className="pointer-events-none fixed z-[60] max-w-[60vw] -translate-x-1/2 -translate-y-1/2 truncate rounded-lg px-2.5 py-1.5 text-xs font-bold text-white shadow-2xl"
          style={{ left: drag.x, top: drag.y, backgroundColor: drag.event.color }}
        >
          {drag.event.title}
        </div>
      )}
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
