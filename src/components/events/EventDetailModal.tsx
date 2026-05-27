import { useState } from "react";
import type { ReactNode } from "react";
import {
  CheckCircle2,
  Clock,
  Edit,
  ExternalLink,
  Image as ImageIcon,
  Link,
  MapPin,
  ShieldCheck,
  Trash2,
  UserRound,
  XCircle
} from "lucide-react";
import { Modal } from "../ui/Modal";
import type { CalendarEvent, EventStatus } from "../../types/event";
import { formatCOP, formatEventDate, formatEventTime } from "../../lib/dateUtils";
import { getEventMeta, getPriorityMeta, getStatusMeta } from "../../lib/eventMeta";
import { EventTypeIcon } from "./EventTypeIcon";

interface EventDetailModalProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onUpdateStatus: (id: string, status: EventStatus) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

export function EventDetailModal({
  event,
  isOpen,
  onClose,
  onEdit,
  onUpdateStatus,
  onDeleteEvent
}: EventDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!event) return null;

  const meta = getEventMeta(event.type);
  const status = getStatusMeta(event.status);
  const priority = getPriorityMeta(event.priority);
  const hasSessionValues = event.type === "session" && (typeof event.totalAmount === "number" || typeof event.paidAmount === "number");

  const handleStatus = async (nextStatus: EventStatus) => {
    if (!event.id) return;
    setBusy(true);
    await onUpdateStatus(event.id, nextStatus);
    setBusy(false);
  };

  const handleDelete = async () => {
    if (!event.id) return;
    setBusy(true);
    await onDeleteEvent(event.id);
    setBusy(false);
    setConfirmDelete(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle del evento" maxWidth="max-w-2xl">
      <div className="space-y-5">
        {event.imageUrl && (
          <div className="overflow-hidden rounded-2xl border border-app-soft bg-app-soft">
            <img src={event.imageUrl} alt={event.title} className="h-52 w-full object-cover" />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${meta.softClass}`}>
              <EventTypeIcon type={event.type} size={14} />
              {meta.label}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${status.softClass}`}>
              {status.label}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${priority.softClass}`}>
              Prioridad {priority.label.toLowerCase()}
            </span>
          </div>

          <div>
            <h2 className="m-0 text-2xl font-black tracking-tight text-app-strong">{event.title}</h2>
            {event.description && <p className="mt-2 text-sm leading-relaxed text-app-muted">{event.description}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoItem icon={<Clock size={16} />} label="Fecha y hora" value={`${formatEventDate(event)} · ${formatEventTime(event)}`} />
          <InfoItem icon={<UserRound size={16} />} label="Responsable" value={event.personInCharge || "Sin responsable"} />
          {(event.participants || event.clientName) && (
            <InfoItem icon={<ShieldCheck size={16} />} label="Participantes" value={event.participants || event.clientName || ""} />
          )}
          {event.location && <InfoItem icon={<MapPin size={16} />} label="Ubicacion" value={event.location} />}
          {event.meetingLink && (
            <div className="rounded-2xl border border-app-soft bg-app-soft p-4 sm:col-span-2">
              <p className="m-0 mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-app-faint">
                <Link size={14} />
                Enlace
              </p>
              <a href={event.meetingLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-app-accent hover:underline">
                Abrir reunion
                <ExternalLink size={13} />
              </a>
            </div>
          )}
          {event.imageUrl && (
            <InfoItem icon={<ImageIcon size={16} />} label="Imagen" value="Adjunta al evento" />
          )}
        </div>

        {hasSessionValues && (
          <div className="rounded-2xl border border-app-soft bg-app-soft p-4">
            <p className="m-0 mb-3 text-xs font-bold uppercase tracking-wide text-app-faint">Informacion de la sesion</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {typeof event.totalAmount === "number" && <AmountItem label="Valor" value={formatCOP(event.totalAmount)} />}
              {typeof event.paidAmount === "number" && <AmountItem label="Abono" value={formatCOP(event.paidAmount)} />}
            </div>
          </div>
        )}

        {event.notes && (
          <div className="rounded-2xl border border-app-soft bg-app-soft p-4">
            <p className="m-0 mb-2 text-xs font-bold uppercase tracking-wide text-app-faint">Notas</p>
            <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-app-muted">{event.notes}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["scheduled", "confirmed", "completed", "cancelled"] as EventStatus[]).map((item) => {
            const itemMeta = getStatusMeta(item);
            return (
              <button
                key={item}
                type="button"
                disabled={busy}
                onClick={() => handleStatus(item)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  event.status === item ? "border-app-accent bg-app-accent text-white" : "border-app-soft bg-app-panel text-app-muted hover:text-app-strong"
                }`}
              >
                {itemMeta.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-app-soft pt-4 sm:flex-row">
          <button type="button" onClick={() => onEdit(event)} className="btn-secondary flex-1">
            <Edit size={16} />
            Editar
          </button>
          <button type="button" onClick={() => event.id && handleStatus("completed")} className="btn-secondary flex-1">
            <CheckCircle2 size={16} />
            Marcar realizado
          </button>
          <button type="button" onClick={() => event.id && handleStatus("cancelled")} className="btn-secondary flex-1">
            <XCircle size={16} />
            Cancelar
          </button>
          {confirmDelete ? (
            <button type="button" onClick={handleDelete} disabled={busy} className="btn-danger flex-1">
              Confirmar
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="btn-danger-soft flex-1">
              <Trash2 size={16} />
              Eliminar
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function InfoItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-app-soft bg-app-soft p-4">
      <p className="m-0 mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-app-faint">
        {icon}
        {label}
      </p>
      <p className="m-0 text-sm font-bold text-app-strong">{value}</p>
    </div>
  );
}

function AmountItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-app-soft bg-app-panel p-3">
      <p className="m-0 text-xs font-bold uppercase tracking-wide text-app-faint">{label}</p>
      <p className="m-0 mt-1 text-base font-black text-app-strong">{value}</p>
    </div>
  );
}
