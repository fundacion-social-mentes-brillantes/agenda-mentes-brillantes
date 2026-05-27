import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, Clock, ListChecks, Plus, Sparkles, UserRound } from "lucide-react";
import { Card } from "../components/ui/Card";
import { EventDetailModal } from "../components/events/EventDetailModal";
import { EventTypeIcon } from "../components/events/EventTypeIcon";
import { endOfDay, formatCOP, formatEventTime, isEventPending, isSameDay, startOfDay, toDate } from "../lib/dateUtils";
import { getEventMeta, getPriorityMeta, getStatusMeta } from "../lib/eventMeta";
import type { CalendarEvent, EventStatus } from "../types/event";
import type { UserProfile } from "../types/user";

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
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
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

  const visualReminders = useMemo(
    () =>
      events
        .filter((event) => {
          const start = toDate(event.startAt);
          const overduePending = start < now && isEventPending(event);
          const nextDay = start >= now && start <= tomorrow;
          return overduePending || nextDay;
        })
        .sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime())
        .slice(0, 5),
    [events, now, tomorrow]
  );

  const upcomingMeetings = useMemo(
    () =>
      events
        .filter((event) => ["meeting", "session"].includes(event.type) && toDate(event.startAt) >= now && event.status !== "cancelled")
        .sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime())
        .slice(0, 4),
    [events, now]
  );

  const pendingTasks = useMemo(
    () =>
      events
        .filter((event) => event.type === "task" && isEventPending(event))
        .sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime())
        .slice(0, 4),
    [events]
  );

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
              <p className="section-label mb-2">{now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</p>
              <h2 className="m-0 text-3xl font-black tracking-tight text-app-strong sm:text-4xl">
                {greeting}, {profile?.name?.split(" ")[0] || "Brillante"}
              </h2>
              <p className="mt-2 text-sm text-app-muted">Organiza tu dia con calma, claridad y conciencia.</p>
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
          <p className="mt-3 max-w-md text-sm leading-relaxed text-app-muted">Crea tu primera sesion, tarea o recordatorio.</p>
          <button type="button" onClick={() => setActivePage("event-form")} className="btn-primary mt-6">
            <Plus size={17} />
            Crear primer evento
          </button>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="space-y-4">
            <SectionHeader icon={<CalendarDays size={20} />} title="Eventos de hoy" count={todayEvents.length} />
            {todayEvents.length === 0 ? (
              <EmptyBlock title="Hoy esta tranquilo" action="Crear evento" onAction={() => setActivePage("event-form")} />
            ) : (
              <div className="grid gap-3">
                {todayEvents.map((event) => (
                  <EventRow key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeader icon={<Clock size={20} />} title="Proximos recordatorios" count={visualReminders.length} />
            {visualReminders.length === 0 ? (
              <EmptyBlock title="Sin recordatorios urgentes" compact />
            ) : (
              <div className="grid gap-3">
                {visualReminders.map((event) => (
                  <CompactEvent key={event.id} event={event} onClick={() => setSelectedEvent(event)} highlight={toDate(event.startAt) < now} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeader icon={<Sparkles size={20} />} title="Proximas reuniones y sesiones" count={upcomingMeetings.length} />
            {upcomingMeetings.length === 0 ? (
              <EmptyBlock title="No hay reuniones proximas" compact />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {upcomingMeetings.map((event) => (
                  <CompactEvent key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeader icon={<ListChecks size={20} />} title="Tareas pendientes" count={pendingTasks.length} />
            {pendingTasks.length === 0 ? (
              <EmptyBlock title="Sin tareas pendientes" compact />
            ) : (
              <div className="grid gap-3">
                {pendingTasks.map((event) => (
                  <CompactEvent key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
                ))}
              </div>
            )}
          </section>
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

function EventRow({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const meta = getEventMeta(event.type);
  const status = getStatusMeta(event.status);
  const priority = getPriorityMeta(event.priority);
  const eventDate = toDate(event.startAt);

  return (
    <Card onClick={onClick} className="border-l-4 p-4 hover:-translate-y-0.5" style={{ borderLeftColor: event.color || meta.color }}>
      <div className="flex gap-4">
        {event.imageUrl && <img src={event.imageUrl} alt={event.title} className="hidden h-20 w-24 rounded-2xl object-cover sm:block" />}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${meta.softClass}`}>
              <EventTypeIcon type={event.type} size={13} />
              {meta.label}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${status.softClass}`}>{status.label}</span>
            {event.priority === "high" && <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${priority.softClass}`}>Importante</span>}
          </div>
          <h3 className="m-0 truncate text-lg font-black text-app-strong">{event.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-app-muted">
            <span>{formatEventTime(event)}</span>
            {event.personInCharge && <span>{event.personInCharge}</span>}
            {!isSameDay(eventDate, new Date()) && <span>{eventDate.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>}
          </div>
          <CoachAmounts event={event} />
        </div>
      </div>
    </Card>
  );
}

function CompactEvent({ event, onClick, highlight = false }: { event: CalendarEvent; onClick: () => void; highlight?: boolean }) {
  const meta = getEventMeta(event.type);
  const date = toDate(event.startAt);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 ${
        highlight ? "border-red-500/25 bg-red-500/10" : "border-app-soft bg-app-panel hover:bg-app-soft"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${meta.softClass}`}>
          <EventTypeIcon type={event.type} size={13} />
          {meta.shortLabel}
        </span>
        <span className="text-xs font-black text-app-faint">{date.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
      </div>
      <p className="m-0 line-clamp-2 font-black text-app-strong">{event.title}</p>
      <p className="m-0 mt-2 text-xs font-bold text-app-muted">{formatEventTime(event)}</p>
      <CoachAmounts event={event} compact />
    </button>
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
  if (hour < 12) return "Buenos dias";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

function CoachAmounts({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  if (event.type !== "session") return null;
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
