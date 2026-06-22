import { useMemo, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { Card } from "../components/ui/Card";
import { EventDetailModal } from "../components/events/EventDetailModal";
import { formatCOP, formatEventTime, toDate } from "../lib/dateUtils";
import type { CalendarEvent } from "../types/event";

interface DayPageProps {
  events: CalendarEvent[];
  setActivePage: (page: string) => void;
  setEditingEvent: (event: CalendarEvent | null) => void;
  onToggleDone: (id: string, done: boolean) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

export default function DayPage({ events, setActivePage, setEditingEvent, onToggleDone, onDeleteEvent }: DayPageProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "done">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const filteredEvents = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    return events
      .filter((event) => {
        const text = `${event.title} ${event.createdByName || ""}`.toLowerCase();
        const matchesSearch = !queryText || text.includes(queryText);
        const matchesTab = activeTab === "pending" ? !event.done : !!event.done;
        return matchesSearch && matchesTab;
      })
      .sort((a, b) => toDate(b.startAt).getTime() - toDate(a.startAt).getTime());
  }, [activeTab, events, searchQuery]);

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
          <p className="mt-2 text-sm text-app-muted">Busca y revisa todos tus eventos en un solo lugar.</p>
        </div>
        <button type="button" onClick={() => setActivePage("event-form")} className="btn-primary">
          <Plus size={18} />
          Crear evento
        </button>
      </div>

      <Card className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-app-faint">
              <Search size={17} />
            </span>
            <input className="input-field pl-11" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por título o persona..." />
          </label>

          <div className="grid grid-cols-2 rounded-2xl border border-app-soft bg-app-soft p-1">
            <button type="button" onClick={() => setActiveTab("pending")} className={`rounded-xl px-4 py-2 text-sm font-black ${activeTab === "pending" ? "bg-app-panel text-app-accent" : "text-app-faint"}`}>
              Pendientes
            </button>
            <button type="button" onClick={() => setActiveTab("done")} className={`rounded-xl px-4 py-2 text-sm font-black ${activeTab === "done" ? "bg-app-panel text-app-accent" : "text-app-faint"}`}>
              Hechos
            </button>
          </div>
        </div>
      </Card>

      {filteredEvents.length === 0 ? (
        <Card className="flex min-h-72 flex-col items-center justify-center border-dashed text-center">
          <Sparkles size={48} className="mb-3 text-app-accent" />
          <h3 className="m-0 text-xl font-black text-app-strong">No encontramos eventos</h3>
          <p className="mt-2 max-w-md text-sm text-app-muted">Cambia la búsqueda o crea un nuevo evento para mantener la agenda viva y clara.</p>
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
        onToggleDone={onToggleDone}
        onDeleteEvent={onDeleteEvent}
      />
    </div>
  );
}

function AgendaCard({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const date = toDate(event.startAt);
  const firstImage = event.attachments?.find((att) => att.kind === "image");

  return (
    <button type="button" onClick={onClick} className="overflow-hidden rounded-3xl border border-app-soft bg-app-panel text-left transition hover:-translate-y-0.5 hover:bg-app-soft">
      {firstImage && <img src={firstImage.url} alt={event.title} className="h-36 w-full object-cover" />}
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: event.color }} />
          <span className="text-xs font-black uppercase tracking-wide text-app-faint">{event.modality}</span>
          {event.done && <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-600">Hecho</span>}
        </div>
        <h3 className={`m-0 line-clamp-2 text-lg font-black leading-tight text-app-strong ${event.done ? "line-through opacity-60" : ""}`}>{event.title}</h3>
        <p className="m-0 text-xs font-bold uppercase text-app-faint">{date.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}</p>
        <p className="m-0 text-sm font-bold text-app-muted">{formatEventTime(event)}</p>
        <Amounts event={event} />
      </div>
    </button>
  );
}

function Amounts({ event }: { event: CalendarEvent }) {
  const hasTotal = typeof event.totalAmount === "number";
  const hasPaid = typeof event.paidAmount === "number";
  if (!hasTotal && !hasPaid) return null;

  return (
    <div className="flex flex-wrap gap-2 text-xs font-black text-app-muted">
      {hasTotal && <span className="rounded-full border border-app-soft bg-app-soft px-2.5 py-1">Valor: {formatCOP(event.totalAmount)}</span>}
      {hasPaid && <span className="rounded-full border border-app-soft bg-app-soft px-2.5 py-1">Abono: {formatCOP(event.paidAmount)}</span>}
    </div>
  );
}
