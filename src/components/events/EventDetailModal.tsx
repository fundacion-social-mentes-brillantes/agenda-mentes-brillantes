import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
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
  UserRound,
  X
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";
import type { CalendarEvent } from "../../types/event";
import { formatCOP, formatEventDate, formatEventTime, toDate } from "../../lib/dateUtils";
import { getModalityLabel } from "../../lib/eventMeta";

interface EventDetailModalProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDuplicate: (event: CalendarEvent, dates: string[]) => Promise<void>;
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

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function dateChipLabel(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
}

export function EventDetailModal({ event, isOpen, onClose, onEdit, onDuplicate, onDeleteEvent }: EventDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"detail" | "duplicate">("detail");
  const [dupDates, setDupDates] = useState<string[]>([]);
  const [dupPick, setDupPick] = useState("");
  const [dupBusy, setDupBusy] = useState(false);
  const [dupDone, setDupDone] = useState(0);

  // Al abrir otro evento (o cerrar), volver siempre a la vista de detalle limpia.
  useEffect(() => {
    setMode("detail");
    setDupDates([]);
    setDupPick("");
    setDupBusy(false);
    setDupDone(0);
    setConfirmDelete(false);
  }, [event?.id, isOpen]);

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

  const addDupDate = (value: string) => {
    if (!value) return;
    setDupDates((prev) => (prev.includes(value) ? prev : [...prev, value].sort()));
    setDupPick("");
  };

  const handleConfirmDuplicate = async () => {
    if (dupDates.length === 0 || dupBusy) return;
    setDupBusy(true);
    try {
      await onDuplicate(event, dupDates);
      setDupDone(dupDates.length);
      window.setTimeout(() => onClose(), 1300);
    } catch {
      setDupBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === "duplicate" ? "Duplicar evento" : "Detalle del evento"} maxWidth="max-w-2xl">
      {mode === "duplicate" ? (
        <div className="space-y-4">
          <button type="button" onClick={() => setMode("detail")} className="inline-flex items-center gap-1.5 text-sm font-bold text-app-muted hover:text-app-strong">
            <ArrowLeft size={15} />
            Volver al detalle
          </button>

          <div className="rounded-2xl border border-app-soft bg-app-soft p-3">
            <p className="m-0 truncate text-sm font-black text-app-strong">{event.title}</p>
            <p className="m-0 mt-1 text-xs text-app-faint">
              Se copiará {event.allDay ? "como todo el día" : `a las ${timeLabel(toDate(event.startAt))}`} en cada fecha que elijas.
            </p>
          </div>

          {dupDone > 0 ? (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-600">
              <CheckCircle2 size={18} />
              Listo, se duplicó en {dupDone} {dupDone === 1 ? "fecha" : "fechas"}.
            </div>
          ) : (
            <>
              <div>
                <span className="section-label mb-2 block">Elige una o varias fechas</span>
                <input type="date" className="input-field" value={dupPick} onChange={(e) => addDupDate(e.target.value)} />
                <span className="mt-1 block text-xs text-app-faint">Toca una fecha para agregarla. Puedes agregar todas las que quieras.</span>
              </div>

              {dupDates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {dupDates.map((d) => (
                    <span key={d} className="inline-flex items-center gap-2 rounded-full border border-app-soft bg-app-soft px-3 py-1.5 text-xs font-bold text-app-strong">
                      {dateChipLabel(d)}
                      <button type="button" onClick={() => setDupDates((prev) => prev.filter((x) => x !== d))} className="text-app-faint hover:text-red-500" aria-label="Quitar fecha">
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <button type="button" onClick={handleConfirmDuplicate} disabled={dupDates.length === 0 || dupBusy} className="btn-primary w-full">
                {dupBusy ? <Spinner className="h-5 w-5" /> : <CalendarPlus size={17} />}
                {dupDates.length === 0 ? "Elige al menos una fecha" : `Duplicar en ${dupDates.length} ${dupDates.length === 1 ? "fecha" : "fechas"}`}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {images.length > 0 && (
            <div className={`grid gap-2 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {images.map((img) => (
                <a key={img.path || img.url} href={img.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-app-soft bg-app-soft">
                  <img src={img.url} alt={img.name} referrerPolicy="no-referrer" className="h-44 w-full object-cover" />
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
              <InfoItem icon={<Layers size={16} />} label="Sesiones compradas" value={String(typeof event.purchasedSessions === "number" && event.purchasedSessions >= 0 ? event.purchasedSessions : 1)} />
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

          {event.description && (
            <div className="rounded-2xl border border-app-soft bg-app-soft p-4">
              <p className="m-0 mb-2 text-xs font-bold uppercase tracking-wide text-app-faint">Descripción</p>
              <LinkifiedText text={event.description} />
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
            <button type="button" onClick={() => setMode("duplicate")} className="btn-secondary flex-1">
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
      )}
    </Modal>
  );
}

const LINK_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi;
const TRAILING_PUNCTUATION = /[),.;!?]+$/;

function LinkifiedText({ text }: { text: string }) {
  return (
    <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-app-muted">
      {text.split(LINK_PATTERN).map((part, index) => {
        if (!/^(https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,})/i.test(part)) return part;

        const trailing = part.match(TRAILING_PUNCTUATION)?.[0] || "";
        const linkText = trailing ? part.slice(0, -trailing.length) : part;
        const href = /^https?:\/\//i.test(linkText) ? linkText : `https://${linkText}`;

        return (
          <Fragment key={`${index}-${part}`}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-bold text-app-accent underline decoration-current/40 underline-offset-2 hover:decoration-current"
            >
              {linkText}
            </a>
            {trailing}
          </Fragment>
        );
      })}
    </p>
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
