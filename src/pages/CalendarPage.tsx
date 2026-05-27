import { useState, useMemo } from "react";
import type { CalendarEvent, EventStatus, EventType } from "../types/event";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  Edit,
  Trash2,
  ExternalLink,
  Sparkles
} from "lucide-react";

interface CalendarPageProps {
  events: CalendarEvent[];
  setActivePage: (page: string) => void;
  setEditingEvent: (event: CalendarEvent | null) => void;
  setSelectedDate: (date: Date) => void;
  onUpdateStatus: (id: string, status: EventStatus) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

export default function CalendarPage({
  events,
  setActivePage,
  setEditingEvent,
  setSelectedDate,
  onUpdateStatus,
  onDeleteEvent
}: CalendarPageProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  
  // Modal states
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysOfWeek = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const monthsNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  // Generate 42 calendar grid cells (6 weeks) starting from Monday
  const gridCells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    
    // JS getDay() is 0 (Sun) - 6 (Sat).
    // Convert to 0 (Mon) - 6 (Sun):
    let startDayIndex = firstDayOfMonth.getDay() - 1;
    if (startDayIndex === -1) startDayIndex = 6;

    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean }[] = [];

    // Prev month padding cells
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, totalDaysInPrevMonth - i);
      cells.push({ date: prevDate, isCurrentMonth: false });
    }

    // Current month cells
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const currDate = new Date(year, month, i);
      cells.push({ date: currDate, isCurrentMonth: true });
    }

    // Next month padding cells to complete 42 cells (6 weeks)
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i);
      cells.push({ date: nextDate, isCurrentMonth: false });
    }

    return cells;
  }, [year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  // Get events happening on a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventStart = new Date(event.startAt as Date);
      return isSameDay(eventStart, date);
    });
  };

  // Selected Day Events
  const selectedDayEvents = useMemo(() => {
    return getEventsForDay(selectedDay);
  }, [selectedDay, events]);

  // Event utilities
  const getEventColorDot = (type: EventType) => {
    switch (type) {
      case "session": return "bg-blue-500";
      case "task": return "bg-violet-500";
      case "reminder": return "bg-amber-500";
      case "family": return "bg-emerald-500";
      case "foundation": return "bg-pink-500";
    }
  };

  const getEventBadgeStyles = (type: EventType) => {
    switch (type) {
      case "session":
        return "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40";
      case "task":
        return "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/40";
      case "reminder":
        return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40";
      case "family":
        return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40";
      case "foundation":
        return "bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-900/40";
    }
  };

  const getEventTypeName = (type: EventType) => {
    const names = {
      session: "Sesión Coach",
      task: "Tarea Interna",
      reminder: "Recordatorio",
      family: "Actividad Familiar",
      foundation: "Actividad Fundación"
    };
    return names[type];
  };

  const getStatusBadgeStyles = (status: EventStatus) => {
    switch (status) {
      case "scheduled":
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
      case "confirmed":
        return "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300";
      case "completed":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
      case "cancelled":
        return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
    }
  };

  const getStatusName = (status: EventStatus) => {
    const names = {
      scheduled: "Programado",
      confirmed: "Confirmado",
      completed: "Completado",
      cancelled: "Cancelado"
    };
    return names[status];
  };

  const formatEventTime = (event: CalendarEvent) => {
    if (event.allDay) return "Todo el día";
    const start = new Date(event.startAt as Date);
    const end = new Date(event.endAt as Date);
    const formatTime = (date: Date) => 
      date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  const handleCreateForDay = () => {
    setSelectedDate(selectedDay);
    setEditingEvent(null);
    setActivePage("event-form");
  };

  const handleEditClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setActivePage("event-form");
    setSelectedEvent(null);
  };

  const handleDeleteClick = async (id: string) => {
    try {
      await onDeleteEvent(id);
      setConfirmDeleteId(null);
      setSelectedEvent(null);
    } catch (error) {
      alert("Error al eliminar el evento.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white m-0 uppercase">
            {monthsNames[month]} {year}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visualiza y planifica las actividades de Mentes Brillantes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Monthly Grid (Col Span 2) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-3xl p-4 shadow-xs">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {daysOfWeek.map((day) => (
              <span key={day} className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2">
                {day}
              </span>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 gap-1">
            {gridCells.map(({ date, isCurrentMonth }, idx) => {
              const dayEvents = getEventsForDay(date);
              const isCellSelected = isSameDay(date, selectedDay);
              const isCellToday = isToday(date);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(date)}
                  className={`
                    relative min-h-[72px] md:min-h-[86px] p-2 rounded-2xl flex flex-col items-start gap-1 justify-between transition-all outline-none border
                    ${isCurrentMonth ? "bg-white dark:bg-slate-900 text-slate-850 dark:text-slate-200" : "bg-slate-50/50 dark:bg-slate-950/20 text-slate-400 dark:text-slate-600"}
                    ${isCellSelected 
                      ? "border-violet-600 dark:border-violet-500 ring-2 ring-violet-500/10" 
                      : "border-slate-50 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    }
                  `}
                >
                  {/* Day Number */}
                  <span className={`
                    text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg
                    ${isCellToday 
                      ? "bg-violet-600 text-white shadow-xs" 
                      : isCellSelected 
                        ? "text-violet-600 dark:text-violet-400 font-extrabold" 
                        : "text-slate-700 dark:text-slate-300"
                    }
                  `}>
                    {date.getDate()}
                  </span>

                  {/* Event Dots/Bar indicator */}
                  <div className="w-full flex flex-wrap gap-1 mt-auto">
                    {/* Visual dot representation for mobile */}
                    <div className="flex gap-1 flex-wrap md:hidden max-h-[12px] overflow-hidden">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span 
                          key={event.id} 
                          className={`w-1.5 h-1.5 rounded-full ${getEventColorDot(event.type)}`}
                        />
                      ))}
                    </div>
                    
                    {/* Desktop titles preview */}
                    <div className="hidden md:flex flex-col gap-0.5 w-full text-[9px] text-left">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div 
                          key={event.id}
                          className="px-1 py-0.5 rounded-sm truncate text-white font-medium"
                          style={{ backgroundColor: event.color }}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[8px] text-slate-400 dark:text-slate-500 pl-1 font-bold">
                          +{dayEvents.length - 2} más
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Events Side Panel (Col Span 1) */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center px-1">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest">Eventos para el</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">
                {selectedDay.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}
              </h3>
            </div>
            
            <button
              onClick={handleCreateForDay}
              className="p-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-md active:scale-95 transition-all"
              title="Crear evento para este día"
            >
              <Plus size={16} className="stroke-[2.5px]" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {selectedDayEvents.length === 0 ? (
              <Card className="flex flex-col items-center justify-center py-10 text-center border-dashed border-slate-200 dark:border-slate-800/80">
                <Sparkles size={32} className="text-slate-300 dark:text-slate-700 mb-2 animate-pulse" />
                <p className="font-semibold text-xs text-slate-500 dark:text-slate-400">No hay eventos este día</p>
                <button
                  onClick={handleCreateForDay}
                  className="mt-3 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Agregar evento nuevo
                </button>
              </Card>
            ) : (
              selectedDayEvents.map((event) => (
                <Card
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="hover:translate-y-[ -1px ] border-l-4 py-4 px-4 hover:shadow-xs active:scale-[0.99]"
                  style={{ borderLeftColor: event.color }}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm border ${getEventBadgeStyles(event.type)}`}>
                        {getEventTypeName(event.type)}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${getStatusBadgeStyles(event.status)}`}>
                        {getStatusName(event.status)}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1 truncate m-0">
                      {event.title}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      <Clock size={11} />
                      <span>{formatEventTime(event)}</span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Event details modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Detalles del Evento"
      >
        {selectedEvent && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${getEventBadgeStyles(selectedEvent.type)}`}>
                  {getEventTypeName(selectedEvent.type)}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getStatusBadgeStyles(selectedEvent.status)}`}>
                  {getStatusName(selectedEvent.status)}
                </span>
              </div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-1 m-0">
                {selectedEvent.title}
              </h4>
              {selectedEvent.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {selectedEvent.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/40 text-xs">
              <div>
                <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Fecha y Hora</p>
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Clock size={13} className="text-violet-600" />
                  <span>
                    {new Date(selectedEvent.startAt as Date).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
                    <br />
                    {formatEventTime(selectedEvent)}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Responsable</p>
                <p className="font-bold text-slate-700 dark:text-slate-300 m-0">{selectedEvent.personInCharge}</p>
              </div>

              {selectedEvent.clientName && (
                <div>
                  <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Cliente / Persona</p>
                  <p className="font-bold text-slate-700 dark:text-slate-300 m-0">{selectedEvent.clientName}</p>
                </div>
              )}

              <div>
                <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Modalidad</p>
                <p className="font-bold text-slate-700 dark:text-slate-300 capitalize m-0">{selectedEvent.modality}</p>
              </div>

              {selectedEvent.location && (
                <div className="col-span-2">
                  <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Ubicación</p>
                  <p className="font-bold text-slate-700 dark:text-slate-300 m-0 truncate">{selectedEvent.location}</p>
                </div>
              )}

              {selectedEvent.meetingLink && (
                <div className="col-span-2">
                  <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Enlace de Reunión</p>
                  <a 
                    href={selectedEvent.meetingLink}
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-1 font-bold text-violet-600 dark:text-violet-400 hover:underline m-0 truncate"
                  >
                    <span>Unirse a reunión</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {selectedEvent.notes && (
                <div className="col-span-2">
                  <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Notas</p>
                  <p className="text-slate-650 dark:text-slate-350 m-0 italic whitespace-pre-wrap">{selectedEvent.notes}</p>
                </div>
              )}
            </div>

            {/* Quick Status Change Actions */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Cambiar Estado</span>
              <div className="grid grid-cols-2 gap-2">
                {(["scheduled", "confirmed", "completed", "cancelled"] as EventStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      onUpdateStatus(selectedEvent.id!, status);
                      setSelectedEvent({ ...selectedEvent, status });
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      selectedEvent.status === status
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    {getStatusName(status)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 dark:border-slate-800/40 pt-4 mt-2">
              <button
                onClick={() => handleEditClick(selectedEvent)}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all"
              >
                <Edit size={16} />
                <span>Editar</span>
              </button>

              {confirmDeleteId === selectedEvent.id ? (
                <div className="flex-1 flex gap-2">
                  <button
                    onClick={() => handleDeleteClick(selectedEvent.id!)}
                    className="flex-1 py-3 px-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="flex-1 py-3 px-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 text-xs font-bold transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(selectedEvent.id!)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-sm font-semibold transition-all border border-red-100 dark:border-red-900/20"
                >
                  <Trash2 size={16} />
                  <span>Eliminar</span>
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
