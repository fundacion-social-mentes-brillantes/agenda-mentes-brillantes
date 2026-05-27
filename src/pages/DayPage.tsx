import { useState, useMemo } from "react";
import type { CalendarEvent, EventStatus, EventType } from "../types/event";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { 
  Sparkles, 
  Search, 
  Clock, 
  MapPin, 
  Video, 
  Phone, 
  CheckCircle2, 
  XCircle,
  Edit,
  Trash2,
  ExternalLink
} from "lucide-react";

interface DayPageProps {
  events: CalendarEvent[];
  setActivePage: (page: string) => void;
  setEditingEvent: (event: CalendarEvent | null) => void;
  onUpdateStatus: (id: string, status: EventStatus) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

export default function DayPage({
  events,
  setActivePage,
  setEditingEvent,
  onUpdateStatus,
  onDeleteEvent
}: DayPageProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal states
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filter only coaching sessions
  const sessions = useMemo(() => {
    return events.filter((e) => e.type === "session");
  }, [events]);

  // Filter by active vs history and search query
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchesSearch = 
        session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (session.clientName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.personInCharge.toLowerCase().includes(searchQuery.toLowerCase());

      const isPending = session.status === "scheduled" || session.status === "confirmed";
      const matchesTab = activeTab === "pending" ? isPending : !isPending;

      return matchesSearch && matchesTab;
    });
  }, [sessions, activeTab, searchQuery]);

  // Event utilities
  const getEventBadgeStyles = (type: EventType) => {
    switch (type) {
      case "session":
        return "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40";
      default:
        return "bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-950/40 dark:text-slate-300 dark:border-slate-900/40";
    }
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
      case "presencial": return <MapPin size={13} />;
      case "virtual": return <Video size={13} />;
      case "llamada": return <Phone size={13} />;
      default: return null;
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
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white m-0">
          Control de Sesiones de Coaching
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Administra las sesiones de Gimnasio Emocional de forma rápida y sencilla.
        </p>
      </div>

      {/* Search and Tabs Panel */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Buscar por cliente, coach o título..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all"
          />
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 dark:bg-slate-850 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab("pending")}
            className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "pending" 
                ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-white shadow-xs" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "history" 
                ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-white shadow-xs" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
            }`}
          >
            Historial
          </button>
        </div>

      </div>

      {/* List of Sessions */}
      <div className="flex flex-col gap-4">
        {filteredSessions.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed border-slate-200 dark:border-slate-800/80">
            <Sparkles size={48} className="text-slate-300 dark:text-slate-700 mb-3 animate-pulse" />
            <p className="font-semibold text-slate-600 dark:text-slate-400">No se encontraron sesiones</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
              Usa la pestaña opuesta o realiza otra búsqueda en tu panel.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSessions.map((session) => {
              const sessionDate = new Date(session.startAt as Date);
              return (
                <Card 
                  key={session.id} 
                  className="flex flex-col justify-between gap-4 border-l-4 border-l-blue-500 hover:shadow-xs active:scale-[0.99]"
                  onClick={() => setSelectedEvent(session)}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${getStatusBadgeStyles(session.status)}`}>
                          {getStatusName(session.status)}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold capitalize flex items-center gap-1">
                          &bull; {getModalityIcon(session.modality)}
                          <span>{session.modality}</span>
                        </span>
                      </div>
                      <h4 className="font-bold text-base text-slate-900 dark:text-white mt-1.5 truncate m-0">
                        {session.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Cliente: <span className="font-bold text-slate-700 dark:text-slate-300">{session.clientName || "N/A"}</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Coach: <span className="font-semibold">{session.personInCharge}</span>
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl text-center shrink-0 border border-slate-100 dark:border-slate-800/40">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider m-0">Fecha</p>
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 mt-0.5 m-0">
                        {sessionDate.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800/40 pt-3 text-xs mt-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Clock size={13} />
                      <span>{formatEventTime(session)}</span>
                    </div>

                    <div className="flex gap-2">
                      {session.status !== "completed" && (
                        <button
                          onClick={() => onUpdateStatus(session.id!, "completed")}
                          className="flex items-center gap-1.5 py-1 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 font-semibold transition-all border border-emerald-100 dark:border-emerald-900/20"
                          title="Marcar como Completada"
                        >
                          <CheckCircle2 size={13} />
                          <span>Completar</span>
                        </button>
                      )}
                      {session.status !== "cancelled" && session.status !== "completed" && (
                        <button
                          onClick={() => onUpdateStatus(session.id!, "cancelled")}
                          className="flex items-center gap-1.5 py-1 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:text-red-400 font-semibold transition-all border border-red-100 dark:border-red-900/20"
                          title="Cancelar Sesión"
                        >
                          <XCircle size={13} />
                          <span>Cancelar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Event details modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Detalles de la Sesión"
      >
        {selectedEvent && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${getEventBadgeStyles(selectedEvent.type)}`}>
                  Sesión de Coaching
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
                <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Coach Responsable</p>
                <p className="font-bold text-slate-700 dark:text-slate-300 m-0">{selectedEvent.personInCharge}</p>
              </div>

              {selectedEvent.clientName && (
                <div>
                  <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Cliente</p>
                  <p className="font-bold text-slate-700 dark:text-slate-300 m-0">{selectedEvent.clientName}</p>
                </div>
              )}

              <div>
                <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Modalidad</p>
                <p className="font-bold text-slate-700 dark:text-slate-300 capitalize m-0">{selectedEvent.modality}</p>
              </div>

              {selectedEvent.location && (
                <div className="col-span-2">
                  <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Lugar</p>
                  <p className="font-bold text-slate-700 dark:text-slate-300 m-0 truncate">{selectedEvent.location}</p>
                </div>
              )}

              {selectedEvent.meetingLink && (
                <div className="col-span-2">
                  <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Enlace Virtual</p>
                  <a 
                    href={selectedEvent.meetingLink}
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-1 font-bold text-violet-600 dark:text-violet-400 hover:underline m-0 truncate"
                  >
                    <span>Unirse a zoom/teams</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {selectedEvent.notes && (
                <div className="col-span-2">
                  <p className="text-slate-400 font-semibold mb-0.5 uppercase tracking-wide">Notas de la sesión</p>
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
