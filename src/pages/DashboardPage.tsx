import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, HeartHandshake, Plus, Sparkles, UserRound } from "lucide-react";
import { Card } from "../components/ui/Card";
import { EventDetailModal } from "../components/events/EventDetailModal";
import { endOfDay, formatCOP, formatEventTime, isSameDay, startOfDay, toDate } from "../lib/dateUtils";
import type { CalendarEvent } from "../types/event";
import type { UserProfile } from "../types/user";

interface DashboardPageProps {
  events: CalendarEvent[];
  profile: UserProfile | null;
  workspaceName?: string;
  setActivePage: (page: string) => void;
  setEditingEvent: (event: CalendarEvent | null) => void;
  onDuplicate: (event: CalendarEvent) => void;
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
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const todayEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const start = toDate(event.startAt);
          return start >= todayStart && start <= todayEnd;
        })
        .sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime()),
    [events, todayEnd, todayStart]
  );

  const shownEvents = filter === "coach" ? todayEvents.filter((e) => e.kind === "coach") : todayEvents;

  const greeting = getGreeting(now);
  const hasNoEvents = events.length === 0;

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedEvent(null);
    setActivePage("event-form");
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="glass-panel overflow-hidden rounded-[2rem] p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-center gap-4">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={profile.name} className="h-16 w-16 rounded-full object-cover shadow-lg" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-black text-white shadow-lg" style={{ backgroundColor: profile?.color || "#d7b46a" }}>
                {profile?.name ? profile.name.slice(0, 2).toUpperCase() : <UserRound size={24} />}
              </div>
            )}
            <div>
              <p className="section-label mb-2">
                {now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
                {workspaceName ? ` · ${workspaceName}` : ""}
              </p>
              <h2 className="m-0 text-3xl font-black tracking-tight text-app-strong sm:text-4xl">
                {greeting}, {profile?.name?.split(" ")[0] || "Brillante"}
              </h2>
              <p className="mt-2 text-sm text-app-muted">Organiza tu día con calma, claridad y conciencia.</p>
            </div>
          </div>

          <button type="button" onClick={() => setActivePage("event-form")} className="btn-primary w-full lg:w-auto">
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
            <div className="grid gap-3">
              {shownEvents.map((event) => (
                <EventRow key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
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

function EventRow({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const eventDate = toDate(event.startAt);
  const firstImage = event.attachments?.find((att) => att.kind === "image");

  return (
    <Card onClick={onClick} className="border-l-4 p-4 hover:-translate-y-0.5" style={{ borderLeftColor: event.color }}>
      <div className="flex gap-4">
        {firstImage && <img src={firstImage.url} alt={event.title} className="hidden h-20 w-24 rounded-2xl object-cover sm:block" />}
        <div className="min-w-0 flex-1">
          <h3 className="m-0 truncate text-lg font-black text-app-strong">{event.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-app-muted">
            <span>{formatEventTime(event)}</span>
            <span className="capitalize">{event.modality}</span>
            {!isSameDay(eventDate, new Date()) && <span>{eventDate.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>}
          </div>
          <Amounts event={event} />
        </div>
      </div>
    </Card>
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

function Amounts({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  const hasTotal = typeof event.totalAmount === "number";
  const hasPaid = typeof event.paidAmount === "number";
  if (!hasTotal && !hasPaid) return null;

  return (
    <div className={`mt-3 flex flex-wrap gap-2 ${compact ? "text-[11px]" : "text-xs"} font-black text-app-muted`}>
      {hasTotal && <span className="rounded-full border border-app-soft bg-app-soft px-2.5 py-1">Valor: {formatCOP(event.totalAmount)}</span>}
      {hasPaid && <span className="rounded-full border border-app-soft bg-app-soft px-2.5 py-1">Abono: {formatCOP(event.paidAmount)}</span>}
    </div>
  );
}
