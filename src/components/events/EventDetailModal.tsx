import { useState } from "react";
import type { ReactNode } from "react";
import {
  CheckCircle2,
  Clock,
  Edit,
  ExternalLink,
  FileText,
  MonitorSmartphone,
  RotateCcw,
  Trash2,
  UserRound,
  MapPin
} from "lucide-react";
import { Modal } from "../ui/Modal";
import type { CalendarEvent } from "../../types/event";
import { formatCOP, formatEventDate, formatEventTime } from "../../lib/dateUtils";
import { getModalityLabel } from "../../lib/eventMeta";

interface EventDetailModalProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onToggleDone: (id: string, done: boolean) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

export function EventDetailModal({ event, isOpen, onClose, onEdit, onToggleDone, onDeleteEvent }: EventDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!event) return null;

  const attachments = event.attachments || [];
  const images = attachments.filter((att) => att.kind === "image");
  const files = attachments.filter((att) => att.kind !== "image");
  const hasAmounts = typeof event.totalAmount === "number" || typeof event.paidAmount === "number";

  const handleToggleDone = async () => {
    if (!event.id) return;
    setBusy(true);
    await onToggleDone(event.id, !event.done);
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
        {images.length > 0 && (
          <div className={`grid gap-2 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {images.map((img) => (
              <a key={img.path || img.url} href={img.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-app-soft bg-app-soft">
                <img src={img.url} alt={img.name} className="h-44 w-full object-cover" />
              </a>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-app-soft px-3 py-1 text-xs font-bold text-app-strong">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: event.color }} />
              {getModalityLabel(event.modality)}
            </span>
            {event.done && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                <CheckCircle2 size={13} />
                Hecho
              </span>
            )}
          </div>

          <h2 className={`m-0 text-2xl font-black tracking-tight text-app-strong ${event.done ? "line-through opacity-70" : ""}`}>{event.title}</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoItem icon={<Clock size={16} />} label="Fecha y hora" value={`${formatEventDate(event)} · ${formatEventTime(event)}`} />
          <InfoItem
            icon={event.modality === "virtual" ? <MonitorSmartphone size={16} /> : <MapPin size={16} />}
            label="Modalidad"
            value={getModalityLabel(event.modality)}
          />
          {event.createdByName && <InfoItem icon={<UserRound size={16} />} label="Creado por" value={event.createdByName} />}
        </div>

        {hasAmounts && (
          <div className="rounded-2xl border border-app-soft bg-app-soft p-4">
            <p className="m-0 mb-3 text-xs font-bold uppercase tracking-wide text-app-faint">Pagos</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {typeof event.totalAmount === "number" && <AmountItem label="Valor total" value={formatCOP(event.totalAmount)} />}
              {typeof event.paidAmount === "number" && <AmountItem label="Abonado" value={formatCOP(event.paidAmount)} />}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div className="space-y-2">
            <p className="m-0 text-xs font-bold uppercase tracking-wide text-app-faint">Documentos</p>
            {files.map((file) => (
              <a
                key={file.path || file.url}
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-app-soft bg-app-panel p-3 transition hover:bg-app-soft"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-app-soft text-app-accent">
                  <FileText size={18} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-app-strong">{file.name}</span>
                <ExternalLink size={15} className="text-app-faint" />
              </a>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-app-soft pt-4 sm:flex-row">
          <button type="button" onClick={handleToggleDone} disabled={busy} className="btn-secondary flex-1">
            {event.done ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
            {event.done ? "Marcar pendiente" : "Marcar hecho"}
          </button>
          <button type="button" onClick={() => onEdit(event)} className="btn-secondary flex-1">
            <Edit size={16} />
            Editar
          </button>
          {confirmDelete ? (
            <button type="button" onClick={handleDelete} disabled={busy} className="btn-danger flex-1">
              Confirmar eliminar
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
