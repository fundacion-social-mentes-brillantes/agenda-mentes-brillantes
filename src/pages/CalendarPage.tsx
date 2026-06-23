import { useMemo, useState } from "react";
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
  onToggleDone: (id: string, done: boolean) => Promise<void>;
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
  onToggleDone,
  onDeleteEvent
}: CalendarPageProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dayModal, setDayModal] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-2xl font-black tracking-tight text-app-strong sm:text-3xl">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="btn-secondary min-h-10 px-3" aria-label="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setCurrentDate(new Date())} className="btn-secondary min-h-10 px-3 text-sm">
            Hoy
          </button>
          <button type="button" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="btn-secondary min-h-10 px-3" aria-label="Mes siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <Card className="p-1.5 sm:p-3">
        <div className="mb-1 grid grid-cols-7">
          {DAYS.map((day) => (
            <span key={day} className="py-1 text-center text-[10px] font-black uppercase text-app-faint sm:text-xs">
              {day}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {gridCells.map(({ date, currentMonth }, index) => {
            const dayEvents = getEventsForDay(date);
            const today = isSameDay(date, new Date());

            return (
              <button
                key={`${date.toISOString()}-${index}`}
                type="button"
                onClick={() => setDayModal(date)}
                className={`flex min-h-[92px] flex-col rounded-xl border p-0.5 text-left transition sm:min-h-[120px] sm:p-1 ${
                  currentMonth ? "border-app-soft bg-app-panel hover:bg-app-soft" : "border-transparent opacity-45"
                }`}
              >
                <span
                  className={`mb-0.5 flex h-5 w-5 items-center justify-center self-start rounded-full text-[11px] font-black sm:h-6 sm:w-6 sm:text-xs ${
                    today ? "bg-app-accent text-slate-950" : "text-app-strong"
                  }`}
                >
                  {date.getDate()}
                </span>
                <div className="flex-1 space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 4).map((event) => (
                    <span
                      key={event.id}
                      title={event.title}
                      className={`block truncate rounded-[4px] px-1 text-[9px] font-semibold leading-[15px] text-white sm:text-[10px] sm:leading-4 ${
                        event.done ? "line-through opacity-60" : ""
                      }`}
                      style={{ backgroundColor: event.color }}
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
        onToggleDone={onToggleDone}
        onDeleteEvent={onDeleteEvent}
      />
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
        <p className={`m-0 truncate text-base font-bold text-app-strong ${event.done ? "line-through opacity-60" : ""}`}>{event.title}</p>
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
