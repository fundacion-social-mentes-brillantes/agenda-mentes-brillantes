import { useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { Card } from "../components/ui/Card";
import { EventDetailModal } from "../components/events/EventDetailModal";
import { formatCOP, formatEventTime, isSameDay, toDate } from "../lib/dateUtils";
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

export default function CalendarPage({
  events,
  setActivePage,
  setEditingEvent,
  setSelectedDate,
  onToggleDone,
  onDeleteEvent
}: CalendarPageProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
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

  const selectedDayEvents = useMemo(
    () =>
      events
        .filter((event) => isSameDay(toDate(event.startAt), selectedDay))
        .sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime()),
    [events, selectedDay]
  );

  const getEventsForDay = (date: Date) => events.filter((event) => isSameDay(toDate(event.startAt), date));

  const handleCreateForDay = () => {
    setSelectedDate(selectedDay);
    setEditingEvent(null);
    setActivePage("event-form");
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedEvent(null);
    setActivePage("event-form");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="section-label mb-2">Calendario mensual</p>
          <h2 className="m-0 text-3xl font-black tracking-tight text-app-strong">
            {MONTHS[month]} {year}
          </h2>
          <p className="mt-2 text-sm text-app-muted">Toca un día para ver su agenda y crear eventos rápidamente.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="btn-secondary min-h-11 px-3" aria-label="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setCurrentDate(new Date())} className="btn-secondary min-h-11 px-4">
            Hoy
          </button>
          <button type="button" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="btn-secondary min-h-11 px-3" aria-label="Mes siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="p-3 sm:p-4">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center">
            {DAYS.map((day) => (
              <span key={day} className="py-2 text-xs font-black text-app-faint">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {gridCells.map(({ date, currentMonth }, index) => {
              const dayEvents = getEventsForDay(date);
              const today = isSameDay(date, new Date());
              const selected = isSameDay(date, selectedDay);

              return (
                <button
                  key={`${date.toISOString()}-${index}`}
                  type="button"
                  onClick={() => setSelectedDay(date)}
                  className={`min-h-[96px] rounded-2xl border p-1.5 text-left transition sm:min-h-[128px] sm:p-2 ${
                    selected
                      ? "border-app-strong bg-app-soft shadow-lg"
                      : currentMonth
                        ? "border-app-soft bg-app-panel hover:bg-app-soft"
                        : "border-transparent bg-app-soft/40 opacity-55"
                  }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black sm:h-7 sm:w-7 ${today ? "bg-app-accent text-slate-950" : "text-app-strong"}`}>
                    {date.getDate()}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 4).map((event) => (
                      <span
                        key={event.id}
                        title={event.title}
                        className={`block truncate rounded px-1 py-0.5 text-[9px] font-bold leading-tight text-white sm:text-[10px] ${event.done ? "opacity-60 line-through" : ""}`}
                        style={{ backgroundColor: event.color }}
                      >
                        {event.title}
                      </span>
                    ))}
                    {dayEvents.length > 4 && <span className="block px-1 text-[9px] font-black text-app-faint sm:text-[10px]">+{dayEvents.length - 4} más</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <aside className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-label mb-2">Agenda del día</p>
              <h3 className="m-0 text-xl font-black text-app-strong">
                {selectedDay.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" })}
              </h3>
            </div>
            <button type="button" onClick={handleCreateForDay} className="btn-primary min-h-11 px-3" aria-label="Crear evento para este día">
              <Plus size={18} />
            </button>
          </div>

          {selectedDayEvents.length === 0 ? (
            <Card className="flex flex-col items-center justify-center border-dashed py-12 text-center">
              <Sparkles size={38} className="mb-3 text-app-accent" />
              <p className="m-0 text-sm font-black text-app-strong">No hay eventos este día</p>
              <button type="button" onClick={handleCreateForDay} className="btn-secondary mt-4">
                <CalendarPlus size={16} />
                Crear evento
              </button>
            </Card>
          ) : (
            <div className="space-y-3">
              {selectedDayEvents.map((event) => (
                <DayEvent key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
              ))}
            </div>
          )}
        </aside>
      </div>

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

function DayEvent({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const firstImage = event.attachments?.find((att) => att.kind === "image");

  return (
    <button type="button" onClick={onClick} className="w-full rounded-3xl border border-app-soft bg-app-panel p-4 text-left transition hover:-translate-y-0.5 hover:bg-app-soft">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: event.color }} />
        <span className="text-xs font-black uppercase tracking-wide text-app-faint">{event.modality}</span>
      </div>
      <p className={`m-0 font-black text-app-strong ${event.done ? "line-through opacity-60" : ""}`}>{event.title}</p>
      <p className="m-0 mt-2 text-xs font-bold text-app-muted">{formatEventTime(event)}</p>
      <Amounts event={event} />
      {firstImage && <img src={firstImage.url} alt={event.title} className="mt-3 h-24 w-full rounded-2xl object-cover" />}
    </button>
  );
}

function Amounts({ event }: { event: CalendarEvent }) {
  const hasTotal = typeof event.totalAmount === "number";
  const hasPaid = typeof event.paidAmount === "number";
  if (!hasTotal && !hasPaid) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-app-muted">
      {hasTotal && <span className="rounded-full border border-app-soft bg-app-soft px-2.5 py-1">Valor: {formatCOP(event.totalAmount)}</span>}
      {hasPaid && <span className="rounded-full border border-app-soft bg-app-soft px-2.5 py-1">Abono: {formatCOP(event.paidAmount)}</span>}
    </div>
  );
}
