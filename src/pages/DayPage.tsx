import { useMemo, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { Card } from "../components/ui/Card";
import { EventDetailModal } from "../components/events/EventDetailModal";
import { FilaEvento } from "../components/events/FilaEvento";
import { useEventosEnErp } from "../hooks/useEventosEnErp";
import { isSameDay, startOfDay, toDate } from "../lib/dateUtils";
import type { CalendarEvent } from "../types/event";

interface DayPageProps {
  events: CalendarEvent[];
  setActivePage: (page: string) => void;
  setEditingEvent: (event: CalendarEvent | null) => void;
  onDuplicate: (event: CalendarEvent, dates: string[]) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

export default function DayPage({ events, setActivePage, setEditingEvent, onDuplicate, onDeleteEvent }: DayPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const filteredEvents = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    return events
      .filter((event) => {
        const text = `${event.title} ${event.createdByName || ""}`.toLowerCase();
        return !queryText || text.includes(queryText);
      })
      .sort((a, b) => toDate(b.startAt).getTime() - toDate(a.startAt).getTime());
  }, [events, searchQuery]);

  // Agrupadas por día. Arriba lo que viene (de hoy en adelante, en orden) y abajo lo
  // anterior (lo más reciente primero): antes la lista arrancaba en el último evento
  // agendado (años adelante) y había que bajar mucho para llegar a hoy.
  // Dentro de cada día, siempre en orden de hora.
  const hoy = new Date();
  const inicioDeHoy = startOfDay(hoy).getTime();
  // Cálculo directo (sin memoria): depende de la fecha de hoy, que cambia sola.
  const agrupar = (lista: CalendarEvent[]) => {
    const grupos: { clave: string; fecha: Date; eventos: CalendarEvent[] }[] = [];
    for (const event of lista) {
      const fecha = toDate(event.startAt);
      const clave = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.clave === clave) ultimo.eventos.push(event);
      else grupos.push({ clave, fecha, eventos: [event] });
    }
    for (const grupo of grupos) grupo.eventos.sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime());
    return grupos;
  };
  const desdeHoy = filteredEvents.filter((e) => toDate(e.startAt).getTime() >= inicioDeHoy).reverse();
  const antes = filteredEvents.filter((e) => toDate(e.startAt).getTime() < inicioDeHoy);
  const proximos = agrupar(desdeHoy);
  const anteriores = agrupar(antes);

  const { registrados: enErp } = useEventosEnErp(filteredEvents);

  const pintarGrupos = (grupos: typeof proximos) =>
    grupos.map((grupo) => (
      <section key={grupo.clave} className="space-y-1.5">
        <h3
          className="sticky top-0 z-10 m-0 -mx-1 flex items-baseline justify-between gap-2 rounded-xl px-1 py-1.5 text-sm font-black text-app-strong backdrop-blur-sm"
          style={{ background: "color-mix(in srgb, var(--app-bg) 86%, transparent)" }}
        >
          <span className="truncate">
            {capitalizar(grupo.fecha.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}
            {isSameDay(grupo.fecha, hoy) && <span className="ml-2 text-xs font-black text-app-accent">Hoy</span>}
          </span>
          <span className="shrink-0 text-xs font-bold text-app-faint">
            {grupo.eventos.length} {grupo.eventos.length === 1 ? "cita" : "citas"}
          </span>
        </h3>
        {grupo.eventos.map((event) => (
          <FilaEvento
            key={event.id}
            event={event}
            enErp={event.kind === "coach" && Boolean(event.id && enErp.has(event.id))}
            onClick={() => setSelectedEvent(event)}
          />
        ))}
      </section>
    ));

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
        <label className="relative block">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-app-faint">
            <Search size={17} />
          </span>
          <input className="input-field pl-11" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por título o persona..." />
        </label>
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
        <div className="space-y-4">
          {proximos.length > 0 && <p className="section-label m-0">Desde hoy</p>}
          {pintarGrupos(proximos)}
          {anteriores.length > 0 && <p className="section-label m-0 border-t border-app-soft pt-4">Anteriores</p>}
          {pintarGrupos(anteriores)}
        </div>
      )}

      <EventDetailModal
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onEdit={handleEdit}
        onDuplicate={onDuplicate}
        onDeleteEvent={onDeleteEvent}
      />
    </div>
  );
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
