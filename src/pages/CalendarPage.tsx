import { useMemo, useRef, useState } from "react";
import type React from "react";
import { Bell, CalendarPlus, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { EventDetailModal } from "../components/events/EventDetailModal";
import { formatCOP, isSameDay, toDate } from "../lib/dateUtils";
import type { CalendarEvent } from "../types/event";

interface CalendarPageProps {
  events: CalendarEvent[];
  setActivePage: (page: string) => void;
  setEditingEvent: (event: CalendarEvent | null) => void;
  setSelectedDate: (date: Date) => void;
  onDuplicate: (event: CalendarEvent) => void;
  onUpdateEvent: (id: string, eventData: Partial<CalendarEvent>) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

const DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function timeStr(date: Date): string {
  return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function CalendarPage({
  events,
  setActivePage,
  setEditingEvent,
  setSelectedDate,
  onDuplicate,
  onUpdateEvent,
  onDeleteEvent
}: CalendarPageProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dayModal, setDayModal] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [drag, setDrag] = useState<{ event: CalendarEvent; x: number; y: number; overKey: string | null } | null>(null);
  const didDragRef = useRef(false);

  const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const moveEventToKey = (event: CalendarEvent, key: string) => {
    const s = toDate(event.startAt);
    const e = toDate(event.endAt);
    const dur = Math.max(0, e.getTime() - s.getTime());
    const [y, m, dd] = key.split("-").map(Number);
    const ns = new Date(y, m - 1, dd, s.getHours(), s.getMinutes(), 0, 0);
    const ne = new Date(ns.getTime() + dur);
    if (event.id) void onUpdateEvent(event.id, { startAt: ns, endAt: ne });
  };

  const startChipDrag = (e: React.PointerEvent, event: CalendarEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
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
        const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        const cell = el?.closest("[data-daykey]") as HTMLElement | null;
        const overKey = cell?.getAttribute("data-daykey") || null;
        if (overKey && overKey !== dateKey(toDate(event.startAt))) moveEventToKey(event, overKey);
        didDragRef.current = true;
        window.setTimeout(() => { didDragRef.current = false; }, 60);
        setDrag(null);
      }
    };
    function cleanup() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    }
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const gridCells = useMemo(() => {
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
    return cells;
  }, [month, year]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const d = toDate(event.startAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) || [];
      list.push(event);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime());
    return map;
  }, [events]);

  const getEventsForDay = (date: Date) => eventsByDay.get(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`) || [];

  const dayModalEvents = dayModal ? getEventsForDay(dayModal) : [];

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedEvent(null);
    setDayModal(null);
    setActivePage("event-form");
  };

  const handleCreateForDay = (date: Date) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setDayModal(null);
    setActivePage("event-form");
  };

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] flex-col gap-3 md:h-[calc(100dvh-6rem)]">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-black tracking-tight text-app-strong sm:text-2xl">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="btn-secondary min-h-9 px-2.5" aria-label="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setCurrentDate(new Date())} className="btn-secondary min-h-9 px-3 text-sm">
            Hoy
          </button>
          <button type="button" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="btn-secondary min-h-9 px-2.5" aria-label="Mes siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col p-1.5 sm:p-3">
        <div className="mb-1 grid grid-cols-7">
          {DAYS.map((day) => (
            <span key={day} className="py-1 text-center text-[10px] font-black uppercase text-app-faint sm:text-xs">
              {day}
            </span>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 grid-rows-6 gap-0.5 sm:gap-1">
          {gridCells.map(({ date, currentMonth }, index) => {
            const dayEvents = getEventsForDay(date);
            const today = isSameDay(date, new Date());

            return (
              <button
                key={`${date.toISOString()}-${index}`}
                type="button"
                data-daykey={dateKey(date)}
                onClick={() => {
                  if (didDragRef.current) return;
                  setDayModal(date);
                }}
                className={`flex min-h-0 flex-col overflow-hidden rounded-xl border p-1 text-left transition ${
                  drag && drag.overKey === dateKey(date)
                    ? "border-2 border-app-accent bg-app-soft ring-2 ring-app-accent"
                    : today
                      ? "border-2 border-app-accent bg-app-soft"
                      : "border-app-soft bg-app-panel hover:bg-app-soft"
                }`}
              >
                <span
                  className={`mb-0.5 flex items-center justify-center self-start rounded-full font-black ${
                    today
                      ? "accent-gradient h-7 w-7 text-sm shadow-md"
                      : `h-5 w-5 text-[11px] sm:h-6 sm:w-6 sm:text-xs ${currentMonth ? "text-app-strong" : "text-app-faint"}`
                  }`}
                >
                  {date.getDate()}
                </span>
                <div className="flex-1 space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 4).map((event) => (
                    <span
                      key={event.id}
                      title={event.title}
                      onPointerDown={(e) => startChipDrag(e, event)}
                      className={`block truncate rounded-[4px] px-1 text-[9px] font-semibold leading-[15px] text-white sm:text-[10px] sm:leading-4 ${
                        drag?.event.id === event.id ? "opacity-40" : ""
                      }`}
                      style={{ backgroundColor: event.color, touchAction: "none" }}
                    >
                      {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 4 && (
                    <span className="block px-1 text-[9px] font-black text-app-faint sm:text-[10px]">+{dayEvents.length - 4} más</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Modal
        isOpen={!!dayModal}
        onClose={() => setDayModal(null)}
        title={dayModal ? capitalize(dayModal.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })) : ""}
        maxWidth="max-w-lg"
      >
        <div className="space-y-3">
          {dayModalEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Sparkles size={36} className="mb-3 text-app-accent" />
              <p className="m-0 text-sm font-black text-app-strong">No hay eventos este día</p>
            </div>
          ) : (
            dayModalEvents.map((event) => <DayRow key={event.id} event={event} onClick={() => setSelectedEvent(event)} />)
          )}

          {dayModal && (
            <button type="button" onClick={() => handleCreateForDay(dayModal)} className="btn-primary w-full">
              <CalendarPlus size={17} />
              Crear evento este día
            </button>
          )}
        </div>
      </Modal>

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
          className="pointer-events-none fixed z-[60] max-w-[40vw] -translate-x-1/2 -translate-y-1/2 truncate rounded-md px-2 py-1 text-[11px] font-bold text-white shadow-2xl"
          style={{ left: drag.x, top: drag.y, backgroundColor: drag.event.color }}
        >
          {drag.event.title}
        </div>
      )}
    </div>
  );
}

function DayRow({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const start = toDate(event.startAt);
  const end = toDate(event.endAt);
  const hasAmount = typeof event.totalAmount === "number" || typeof event.paidAmount === "number";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-stretch gap-3 rounded-2xl border border-app-soft bg-app-panel p-3 text-left transition hover:bg-app-soft"
    >
      <div className="flex w-[68px] shrink-0 flex-col justify-center">
        {event.allDay ? (
          <span className="text-xs font-black text-app-muted">Todo el día</span>
        ) : (
          <>
            <span className="text-sm font-black leading-tight text-app-strong">{timeStr(start)}</span>
            <span className="text-xs leading-tight text-app-faint">{timeStr(end)}</span>
          </>
        )}
      </div>
      <span className="w-1.5 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-base font-bold text-app-strong">{event.title}</p>
        <p className="m-0 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-app-faint">
          <span className="capitalize">{event.modality}</span>
          {!!event.reminderMinutes && (
            <span className="inline-flex items-center gap-1">
              <Bell size={11} /> recordatorio
            </span>
          )}
          {hasAmount && typeof event.totalAmount === "number" && <span>Valor {formatCOP(event.totalAmount)}</span>}
        </p>
      </div>
    </button>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
