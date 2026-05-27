import { useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { Card } from "../components/ui/Card";
import { EventDetailModal } from "../components/events/EventDetailModal";
import { EventTypeIcon } from "../components/events/EventTypeIcon";
import { formatEventTime, isSameDay, toDate } from "../lib/dateUtils";
import { getEventMeta, getStatusMeta } from "../lib/eventMeta";
import type { CalendarEvent, EventStatus } from "../types/event";

interface CalendarPageProps {
  events: CalendarEvent[];
  setActivePage: (page: string) => void;
  setEditingEvent: (event: CalendarEvent | null) => void;
  setSelectedDate: (date: Date) => void;
  onUpdateStatus: (id: string, status: EventStatus) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

const DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function CalendarPage({
  events,
  setActivePage,
  setEditingEvent,
  setSelectedDate,
  onUpdateStatus,
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
          <p className="mt-2 text-sm text-app-muted">Toca un dia para ver su agenda y crear eventos rapidamente.</p>
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
                  className={`min-h-[76px] rounded-2xl border p-2 text-left transition sm:min-h-[104px] ${
                    selected
                      ? "border-app-strong bg-app-soft shadow-lg"
                      : currentMonth
                        ? "border-app-soft bg-app-panel hover:bg-app-soft"
                        : "border-transparent bg-app-soft/40 opacity-55"
                  }`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs font-black ${today ? "bg-app-accent text-slate-950" : "text-app-strong"}`}>
                    {date.getDate()}
                  </span>
                  <div className="mt-2 hidden space-y-1 sm:block">
                    {dayEvents.slice(0, 2).map((event) => {
                      const meta = getEventMeta(event.type);
                      return (
                        <span key={event.id} className="block truncate rounded-lg px-2 py-1 text-[10px] font-black text-white" style={{ backgroundColor: event.color || meta.color }}>
                          {event.title}
                        </span>
                      );
                    })}
                    {dayEvents.length > 2 && <span className="block text-[10px] font-black text-app-faint">+{dayEvents.length - 2} mas</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1 sm:hidden">
                    {dayEvents.slice(0, 4).map((event) => (
                      <span key={event.id} className="h-2 w-2 rounded-full" style={{ backgroundColor: event.color || getEventMeta(event.type).color }} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <aside className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-label mb-2">Agenda del dia</p>
              <h3 className="m-0 text-xl font-black text-app-strong">
                {selectedDay.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" })}
              </h3>
            </div>
            <button type="button" onClick={handleCreateForDay} className="btn-primary min-h-11 px-3" aria-label="Crear evento para este dia">
              <Plus size={18} />
            </button>
          </div>

          {selectedDayEvents.length === 0 ? (
            <Card className="flex flex-col items-center justify-center border-dashed py-12 text-center">
              <Sparkles size={38} className="mb-3 text-app-accent" />
              <p className="m-0 text-sm font-black text-app-strong">No hay eventos este dia</p>
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
        onUpdateStatus={onUpdateStatus}
        onDeleteEvent={onDeleteEvent}
      />
    </div>
  );
}

function DayEvent({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const meta = getEventMeta(event.type);
  const status = getStatusMeta(event.status);

  return (
    <button type="button" onClick={onClick} className="w-full rounded-3xl border border-app-soft bg-app-panel p-4 text-left transition hover:-translate-y-0.5 hover:bg-app-soft">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${meta.softClass}`}>
          <EventTypeIcon type={event.type} size={13} />
          {meta.label}
        </span>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${status.softClass}`}>{status.label}</span>
      </div>
      <p className="m-0 font-black text-app-strong">{event.title}</p>
      <p className="m-0 mt-2 text-xs font-bold text-app-muted">{formatEventTime(event)}</p>
      {event.imageUrl && <img src={event.imageUrl} alt={event.title} className="mt-3 h-24 w-full rounded-2xl object-cover" />}
    </button>
  );
}

