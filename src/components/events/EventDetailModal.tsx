import { useState } from "react";
import type { ReactNode } from "react";
import {
  Clock,
  Copy,
  Edit,
  ExternalLink,
  FileText,
  History,
  Layers,
  MapPin,
  MonitorSmartphone,
  Trash2,
  UserRound
} from "lucide-react";
import { Modal } from "../ui/Modal";
import type { CalendarEvent } from "../../types/event";
import { formatCOP, formatEventDate, formatEventTime, toDate } from "../../lib/dateUtils";
import { getModalityLabel } from "../../lib/eventMeta";

interface EventDetailModalProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDuplicate: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => Promise<void>;
}

function formatDateTime(value: CalendarEvent["createdAt"]): string {
  return toDate(value).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

export function EventDetailModal({ event, isOpen, onClose, onEdit, onDuplicate, onDeleteEvent }: EventDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!event) return null;

  const attachments = event.attachments || [];
  const images = attachments.filter((att) => att.kind === "image");
  const files = attachments.filter((att) => att.kind !== "image");
  const hasAmounts = typeof event.totalAmount === "number" || typeof event.paidAmount === "number";

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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-app-soft px-3 py-1 text-xs font-bold text-app-strong">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: event.color }} />
            {getModalityLabel(event.modality)}
          </span>
          <h2 className="m-0 text-2xl font-black tracking-tight text-app-strong">{event.title}</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoItem icon={<Clock size={16} />} label="Fecha y hora" value={`${formatEventDate(event)} · ${formatEventTime(event)}`} />
          <InfoItem
            icon={event.modality === "virtual" ? <MonitorSmartphone size={16} /> : <MapPin size={16} />}
            label="Modalidad"
            value={getModalityLabel(event.modality)}
          />
          {event.kind === "coach" && (
            <InfoItem icon={<Layers size={16} />} label="Sesiones compradas" value={String(event.purchasedSessions && event.purchasedSessions > 0 ? event.purchasedSessions : 1)} />
          )}
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

        {event.notes && (
          <div className="rounded-2xl border border-app-soft bg-app-soft p-4">
            <p className="m-0 mb-1 text-xs font-bold uppercase tracking-wide text-app-faint">Nota</p>
            <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-app-muted">{event.notes}</p>
          </div>
        )}

        <div className="rounded-2xl border border-app-soft bg-app-soft p-3">
          <p className="m-0 flex items-center gap-2 text-xs font-semibold text-app-faint">
            <History size={13} />
            Agregado el {formatDateTime(event.createdAt)}
          </p>
          <p className="m-0 mt-1 flex items-center gap-2 text-xs font-semibold text-app-faint">
            <Edit size={13} />
            Última modificación el {formatDateTime(event.updatedAt)}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-app-soft pt-4 sm:flex-row">
          <button type="button" onClick={() => onEdit(event)} className="btn-secondary flex-1">
            <Edit size={16} />
            Editar
          </button>
          <button type="button" onClick={() => { onDuplicate(event); onClose(); }} className="btn-secondary flex-1">
            <Copy size={16} />
            Duplicar
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
