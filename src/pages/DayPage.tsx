import { useMemo, useState } from "react";
import { Filter, Plus, Search, Sparkles } from "lucide-react";
import { Card } from "../components/ui/Card";
import { EventDetailModal } from "../components/events/EventDetailModal";
import { EventTypeIcon } from "../components/events/EventTypeIcon";
import { formatEventTime, isEventPending, toDate } from "../lib/dateUtils";
import { EVENT_TYPE_OPTIONS, getEventMeta, getStatusMeta } from "../lib/eventMeta";
import type { CalendarEvent, EventStatus, EventType } from "../types/event";

interface DayPageProps {
  events: CalendarEvent[];
  setActivePage: (page: string) => void;
  setEditingEvent: (event: CalendarEvent | null) => void;
  onUpdateStatus: (id: string, status: EventStatus) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

export default function DayPage({ events, setActivePage, setEditingEvent, onUpdateStatus, onDeleteEvent }: DayPageProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events
      .filter((event) => {
        const text = `${event.title} ${event.description || ""} ${event.participants || ""} ${event.clientName || ""} ${event.personInCharge || ""}`.toLowerCase();
        const matchesSearch = !query || text.includes(query);
        const matchesType = typeFilter === "all" || event.type === typeFilter;
        const matchesTab = activeTab === "pending" ? isEventPending(event) : !isEventPending(event);
        return matchesSearch && matchesType && matchesTab;
      })
      .sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime());
  }, [activeTab, events, searchQuery, typeFilter]);

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedEvent(null);
    setActivePage("event-form");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="section-label mb-2">Lista general</p>
          <h2 className="m-0 text-3xl font-black tracking-tight text-app-strong">Agenda completa</h2>
          <p className="mt-2 text-sm text-app-muted">Busca sesiones, reuniones, tareas, pagos, salud, familia y fundacion en un solo lugar.</p>
        </div>
        <button type="button" onClick={() => setActivePage("event-form")} className="btn-primary">
          <Plus size={18} />
          Crear evento
        </button>
      </div>

      <Card className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-app-faint">
              <Search size={17} />
            </span>
            <input className="input-field pl-11" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por titulo, responsable o persona..." />
          </label>

          <div className="grid grid-cols-2 rounded-2xl border border-app-soft bg-app-soft p-1">
            <button type="button" onClick={() => setActiveTab("pending")} className={`rounded-xl px-4 py-2 text-sm font-black ${activeTab === "pending" ? "bg-app-panel text-app-accent" : "text-app-faint"}`}>
              Pendientes
            </button>
            <button type="button" onClick={() => setActiveTab("history")} className={`rounded-xl px-4 py-2 text-sm font-black ${activeTab === "history" ? "bg-app-panel text-app-accent" : "text-app-faint"}`}>
              Historial
            </button>
          </div>

          <label className="relative min-w-52">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-app-faint">
              <Filter size={17} />
            </span>
            <select className="input-field pl-11" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as EventType | "all")}>
              <option value="all">Todos los tipos</option>
              {EVENT_TYPE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {filteredEvents.length === 0 ? (
        <Card className="flex min-h-72 flex-col items-center justify-center border-dashed text-center">
          <Sparkles size={48} className="mb-3 text-app-accent" />
          <h3 className="m-0 text-xl font-black text-app-strong">No encontramos eventos</h3>
          <p className="mt-2 max-w-md text-sm text-app-muted">Cambia el filtro o crea un nuevo evento para mantener la agenda viva y clara.</p>
          <button type="button" onClick={() => setActivePage("event-form")} className="btn-secondary mt-5">
            <Plus size={16} />
            Crear evento
          </button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEvents.map((event) => (
            <AgendaCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
          ))}
        </div>
      )}

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

function AgendaCard({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const meta = getEventMeta(event.type);
  const status = getStatusMeta(event.status);
  const date = toDate(event.startAt);

  return (
    <button type="button" onClick={onClick} className="overflow-hidden rounded-3xl border border-app-soft bg-app-panel text-left transition hover:-translate-y-0.5 hover:bg-app-soft">
      {event.imageUrl && <img src={event.imageUrl} alt={event.title} className="h-36 w-full object-cover" />}
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${meta.softClass}`}>
            <EventTypeIcon type={event.type} size={13} />
            {meta.label}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${status.softClass}`}>{status.label}</span>
        </div>
        <h3 className="m-0 line-clamp-2 text-lg font-black leading-tight text-app-strong">{event.title}</h3>
        <p className="m-0 text-xs font-bold uppercase text-app-faint">{date.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}</p>
        <p className="m-0 text-sm font-bold text-app-muted">{formatEventTime(event)}</p>
        {(event.participants || event.personInCharge) && (
          <p className="m-0 truncate text-xs font-semibold text-app-faint">{event.participants || event.personInCharge}</p>
        )}
      </div>
    </button>
  );
}

