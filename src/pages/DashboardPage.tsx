import { useState } from "react";
import type { CalendarEvent, EventStatus, EventType } from "../types/event";
import type { UserProfile } from "../types/user";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { 
  Plus, 
  CalendarDays, 
  Sparkles, 
  Clock, 
  MapPin, 
  Video, 
  Phone, 
  User as UserIcon,
  Trash2,
  Edit,
  ExternalLink
} from "lucide-react";

interface DashboardPageProps {
  events: CalendarEvent[];
  profile: UserProfile | null;
  setActivePage: (page: string) => void;
  setEditingEvent: (event: CalendarEvent | null) => void;
  onUpdateStatus: (id: string, status: EventStatus) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

export default function DashboardPage({
  events,
  profile,
  setActivePage,
  setEditingEvent,
  onUpdateStatus,
  onDeleteEvent
}: DashboardPageProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Time-based greeting helper
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return "¡Buenos días";
    if (hours < 18) return "¡Buenas tardes";
    return "¡Buenas noches";
  };

  // Get current date boundaries
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Filter events for today
  const todayEvents = events.filter((event) => {
    const eventStart = new Date(event.startAt as Date);
    return eventStart >= startOfToday && eventStart <= endOfToday;
  });

  // Filter upcoming coaching sessions (today or future)
  const upcomingSessions = events
    .filter((event) => {
      const eventStart = new Date(event.startAt as Date);
      return event.type === "session" && eventStart >= startOfToday;
    })
    .slice(0, 4); // Limit to top 4

  // Event utilities
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

  const getModalityIcon = (modality: string) => {
    switch (modality) {
      case "presencial":
        return <MapPin size={14} />;
      case "virtual":
        return <Video size={14} />;
      case "llamada":
        return <Phone size={14} />;
      default:
        return null;
    }
  };

  const formatEventTime = (event: CalendarEvent) => {
    if (event.allDay) return "Todo el día";
    const start = new Date(event.startAt as Date);
    const end = new Date(event.endAt as Date);
    const formatTime = (date: Date) => 
      date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${formatTime(start)} - ${formatTime(end)}`;
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
    <div className="flex flex-col gap-8">
      {/* Welcome message */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white m-0">
            {getGreeting()}, {profile?.name || "Brillante"} ✨
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-base">
            Que hoy sea un día lleno de paz, luz y propósito para tu gimnasio emocional.
          </p>
        </div>
        
        {/* Quick action button */}
        <button
          onClick={() => {
            setEditingEvent(null);
            setActivePage("event-form");
          }}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-md shadow-violet-500/20 active:scale-98 transition-all w-full md:w-auto justify-center"
        >
          <Plus size={18} className="stroke-[2.5px]" />
          <span>Nuevo Evento</span>
        </button>
      </div>

      {/* Grid containing Today and Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Today's Agenda (Col Span 2) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <CalendarDays size={20} className="text-violet-600 dark:text-violet-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">Agenda de Hoy</h3>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold px-2.5 py-1 rounded-full">
              {todayEvents.length}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {todayEvents.length === 0 ? (
              <Card className="flex flex-col items-center justify-center py-12 text-center border-dashed border-slate-200 dark:border-slate-800/80">
                <CalendarDays size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
                <p className="font-semibold text-slate-600 dark:text-slate-400">No hay eventos para hoy</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mt-1">
                  Tu agenda está limpia. Usa el botón de arriba para programar sesiones o tareas.
                </p>
              </Card>
            ) : (
              todayEvents.map((event) => (
                <Card 
                  key={event.id} 
                  onClick={() => setSelectedEvent(event)}
                  className="hover:translate-x-1 active:scale-[0.99] border-l-4"
                  style={{ borderLeftColor: event.color }}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${getEventBadgeStyles(event.type)}`}>
                          {getEventTypeName(event.type)}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getStatusBadgeStyles(event.status)}`}>
                          {getStatusName(event.status)}
                        </span>
                      </div>
                      <h4 className="font-bold text-base text-slate-900 dark:text-white mt-1 truncate m-0">
                        {event.title}
                      </h4>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-2">
                        <div className="flex items-center gap-1">
                          <Clock size={13} />
                          <span>{formatEventTime(event)}</span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1 truncate max-w-[200px]">
                            {getModalityIcon(event.modality)}
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold m-0">RESPONSABLE</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px] m-0">{event.personInCharge}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Coaching Sessions (Col Span 1) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <Sparkles size={20} className="text-violet-600 dark:text-violet-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">Próximas Sesiones</h3>
          </div>

          <div className="flex flex-col gap-4">
            {upcomingSessions.length === 0 ? (
              <Card className="flex flex-col items-center justify-center py-10 text-center border-dashed border-slate-200 dark:border-slate-800/80">
                <Sparkles size={36} className="text-slate-300 dark:text-slate-700 mb-2" />
                <p className="font-semibold text-xs text-slate-600 dark:text-slate-400">No hay sesiones agendadas</p>
              </Card>
            ) : (
              upcomingSessions.map((session) => {
                const sessionDate = new Date(session.startAt as Date);
                const day = sessionDate.toLocaleDateString("es-ES", { day: "numeric" });
                const month = sessionDate.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
                
                return (
                  <Card 
                    key={session.id}
                    onClick={() => setSelectedEvent(session)}
                    className="hover:shadow-md py-4 px-4 flex gap-4 items-center"
                  >
                    {/* Compact Date Box */}
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl flex flex-col items-center justify-center shrink-0">
                      <span className="text-lg font-extrabold leading-none">{day}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">{month}</span>
                    </div>

                    {/* Session Details */}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate m-0">{session.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                        Cliente: <span className="font-semibold text-slate-700 dark:text-slate-300">{session.clientName || "N/A"}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                        <Clock size={11} />
                        <span>
                          {sessionDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true })}
                        </span>
                        <span className="capitalize">&bull; {session.modality}</span>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Event Details Quick-View Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Detalles del Evento"
      >
        {selectedEvent && (
          <div className="flex flex-col gap-6">
            {/* Header info */}
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

            {/* Event parameters */}
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
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <UserIcon size={13} className="text-violet-600" />
                  <span>{selectedEvent.personInCharge}</span>
                </div>
              </div>

              {selectedEvent.clientName && (
                <div>
                  <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Cliente / Persona</p>
                  <p className="font-bold text-slate-700 dark:text-slate-300 m-0">{selectedEvent.clientName}</p>
                </div>
              )}

              <div>
                <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Modalidad</p>
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 capitalize">
                  {getModalityIcon(selectedEvent.modality)}
                  <span>{selectedEvent.modality}</span>
                </div>
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
                  <p className="text-slate-600 dark:text-slate-400 m-0 italic whitespace-pre-wrap">{selectedEvent.notes}</p>
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
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    {getStatusName(status)}
                  </button>
                ))}
              </div>
            </div>

            {/* Edit / Delete Buttons */}
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
