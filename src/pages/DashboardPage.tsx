import { useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, HeartHandshake, Plus, Sparkles, UserRound } from "lucide-react";
import { Card } from "../components/ui/Card";
import { EventDetailModal } from "../components/events/EventDetailModal";
import { FilaEvento } from "../components/events/FilaEvento";
import { useEventosEnErp } from "../hooks/useEventosEnErp";
import { endOfDay, startOfDay, toDate } from "../lib/dateUtils";
import type { CalendarEvent } from "../types/event";
import type { UserProfile } from "../types/user";

interface DashboardPageProps {
  events: CalendarEvent[];
  profile: UserProfile | null;
  workspaceName?: string;
  setActivePage: (page: string) => void;
  setEditingEvent: (event: CalendarEvent | null) => void;
  onDuplicate: (event: CalendarEvent, dates: string[]) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

export default function DashboardPage({
  events,
  profile,
  workspaceName,
  setActivePage,
  setEditingEvent,
  onDuplicate,
  onDeleteEvent
}: DashboardPageProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [filter, setFilter] = useState<"all" | "coach">("all");
  const now = new Date();
  const desdeHoy = startOfDay(now).getTime();
  const hastaHoy = endOfDay(now).getTime();

  // Calculo directo: son los eventos de un solo dia y la "memoria" que tenia no
  // servia (dependia de fechas nuevas en cada render).
  const todayEvents = events
    .filter((event) => {
      const start = toDate(event.startAt).getTime();
      return start >= desdeHoy && start <= hastaHoy;
    })
    .sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime());

  const shownEvents = filter === "coach" ? todayEvents.filter((e) => e.kind === "coach") : todayEvents;
  // Sesiones coach de hoy que ya están en la contabilidad (marca verde en la fila).
  const { registrados: enErp } = useEventosEnErp(todayEvents);

  const greeting = getGreeting(now);
  const hasNoEvents = events.length === 0;

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedEvent(null);
    setActivePage("event-form");
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="glass-panel overflow-hidden rounded-[2rem] p-4 sm:p-7">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-center gap-3 sm:gap-4">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={profile.name} referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded-full object-cover shadow-lg sm:h-16 sm:w-16" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black text-white shadow-lg sm:h-16 sm:w-16 sm:text-xl" style={{ backgroundColor: profile?.color || "#d7b46a" }}>
                {profile?.name ? profile.name.slice(0, 2).toUpperCase() : <UserRound size={24} />}
              </div>
            )}
            <div>
              <p className="section-label mb-2">
                {now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
                {workspaceName ? ` · ${workspaceName}` : ""}
              </p>
              <h2 className="m-0 text-2xl font-black tracking-tight text-app-strong sm:text-4xl">
                {greeting}, {profile?.name?.split(" ")[0] || "Brillante"}
              </h2>
              <p className="mt-1 text-sm text-app-muted sm:mt-2">Organiza tu día con calma, claridad y conciencia.</p>
            </div>
          </div>

          <button type="button" onClick={() => setActivePage("event-form")} className="btn-primary hidden w-full sm:flex lg:w-auto">
            <Plus size={18} />
            Nuevo evento
          </button>
        </div>
      </section>

      {hasNoEvents ? (
        <Card className="flex min-h-80 flex-col items-center justify-center border-dashed text-center">
          <Sparkles size={54} className="mb-4 text-app-accent" />
          <h3 className="m-0 text-2xl font-black text-app-strong">Bienvenido a tu agenda</h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-app-muted">Crea tu primera sesión, reunión o recordatorio.</p>
          <button type="button" onClick={() => setActivePage("event-form")} className="btn-primary mt-6">
            <Plus size={17} />
            Crear primer evento
          </button>
        </Card>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeader icon={<CalendarDays size={20} />} title="Eventos de hoy" count={shownEvents.length} />
            <div className="flex gap-1 rounded-2xl border border-app-soft bg-app-soft p-1">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${filter === "all" ? "bg-app-panel text-app-accent shadow-sm" : "text-app-muted"}`}
              >
                Todo
              </button>
              <button
                type="button"
                onClick={() => setFilter("coach")}
                className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition ${filter === "coach" ? "bg-app-panel text-app-accent shadow-sm" : "text-app-muted"}`}
              >
                <HeartHandshake size={13} /> Coach
              </button>
            </div>
          </div>
          {shownEvents.length === 0 ? (
            <EmptyBlock
              title={filter === "coach" ? "Hoy no hay sesiones coach" : "Hoy está tranquilo"}
              action="Crear evento"
              onAction={() => setActivePage("event-form")}
            />
          ) : (
            <div className="space-y-1.5">
              {shownEvents.map((event) => (
                <FilaEvento
                  key={event.id}
                  event={event}
                  ahora={now}
                  enErp={event.kind === "coach" && Boolean(event.id && enErp.has(event.id))}
                  onClick={() => setSelectedEvent(event)}
                />
              ))}
            </div>
          )}
        </section>
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


function SectionHeader({ icon, title, count }: { icon: ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-app-accent">{icon}</span>
      <h3 className="m-0 text-lg font-black text-app-strong">{title}</h3>
      <span className="rounded-full border border-app-soft bg-app-soft px-2.5 py-1 text-xs font-black text-app-muted">{count}</span>
    </div>
  );
}

function EmptyBlock({ title, action, onAction, compact = false }: { title: string; action?: string; onAction?: () => void; compact?: boolean }) {
  return (
    <Card className={`flex flex-col items-center justify-center border-dashed text-center ${compact ? "py-8" : "py-12"}`}>
      <Sparkles size={compact ? 30 : 42} className="mb-3 text-app-accent" />
      <p className="m-0 text-sm font-black text-app-strong">{title}</p>
      {action && onAction && (
        <button type="button" onClick={onAction} className="btn-secondary mt-4">
          <Plus size={16} />
          {action}
        </button>
      )}
    </Card>
  );
}

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

