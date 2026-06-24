import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FileText,
  HeartHandshake,
  Image as ImageIcon,
  Paperclip,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  UserRound,
  X
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { COLOR_PRESETS, DEFAULT_EVENT_COLOR, MODALITY_OPTIONS, REMINDER_OPTIONS } from "../lib/eventMeta";
import { auth } from "../lib/firebase";
import { storageService } from "../services/storageService";
import { normalizeText } from "../services/clientsService";
import type { EventWriteResult } from "../services/eventsService";
import type { CalendarEvent, EventAttachment, EventKind, EventModality } from "../types/event";
import type { Client } from "../types/client";
import type { UserProfile } from "../types/user";

interface PendingFile {
  id: string;
  file: File;
  previewUrl?: string;
}

interface EventFormPageProps {
  editingEvent: CalendarEvent | null;
  selectedDate: Date | null;
  workspaceId: string | null;
  workspaceName?: string;
  profile: UserProfile | null;
  clients: Client[];
  initialKind?: EventKind;
  initialClient?: { code: number; name: string } | null;
  onCreateClient: (name: string) => Promise<Client>;
  setActivePage: (page: string) => void;
  onCreateEvent: (eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">) => Promise<EventWriteResult>;
  onUpdateEvent: (id: string, eventData: Partial<CalendarEvent>) => Promise<void>;
}

export default function EventFormPage({
  editingEvent,
  selectedDate,
  workspaceId,
  workspaceName,
  profile,
  clients,
  initialKind,
  initialClient,
  onCreateClient,
  setActivePage,
  onCreateEvent,
  onUpdateEvent
}: EventFormPageProps) {
  const isEdit = !!editingEvent;

  const [kind, setKind] = useState<EventKind>("normal");
  const [client, setClient] = useState<{ code: number; name: string } | null>(null);
  const [title, setTitle] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [startTimeStr, setStartTimeStr] = useState("09:00");
  const [endTimeStr, setEndTimeStr] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [modality, setModality] = useState<EventModality>("otro");
  const [color, setColor] = useState(DEFAULT_EVENT_COLOR);
  const [reminderMinutes, setReminderMinutes] = useState<number>(30);
  const [totalAmount, setTotalAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");

  const [existingAttachments, setExistingAttachments] = useState<EventAttachment[]>([]);
  const [removedAttachments, setRemovedAttachments] = useState<EventAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const [submitPhase, setSubmitPhase] = useState<"idle" | "saving" | "uploading" | "saved" | "error">("idle");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const pendingFilesRef = useRef<PendingFile[]>([]);
  pendingFilesRef.current = pendingFiles;

  const isBusy = submitPhase === "saving" || submitPhase === "uploading";
  const submitLabel = getSubmitLabel(submitPhase);
  const submitDisabled = isBusy || submitPhase === "saved";
  const attachmentsEnabled = storageService.isConfigured();
  const modeBtnClass = (active: boolean) =>
    `flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black transition ${
      active ? "border-app-strong bg-app-soft text-app-accent" : "border-app-soft bg-app-panel text-app-muted hover:bg-app-soft"
    }`;

  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  useEffect(() => {
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const formatTime = (date: Date) => {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    };

    if (isEdit && editingEvent) {
      const start = new Date(editingEvent.startAt as Date);
      const end = new Date(editingEvent.endAt as Date);
      const evKind = editingEvent.kind === "coach" ? "coach" : "normal";
      setKind(evKind);
      setClient(
        evKind === "coach" && typeof editingEvent.clientCode === "number"
          ? { code: editingEvent.clientCode, name: editingEvent.clientName || editingEvent.title || "" }
          : null
      );
      setTitle(editingEvent.title || "");
      setDateStr(formatDate(start));
      setStartTimeStr(formatTime(start));
      setEndTimeStr(formatTime(end));
      setAllDay(!!editingEvent.allDay);
      setModality(editingEvent.modality || "otro");
      setColor(editingEvent.color || DEFAULT_EVENT_COLOR);
      setReminderMinutes(editingEvent.reminderMinutes ?? 30);
      setTotalAmount(formatMoneyInput(editingEvent.totalAmount));
      setPaidAmount(formatMoneyInput(editingEvent.paidAmount));
      setExistingAttachments(editingEvent.attachments || []);
      setSavedEventId(editingEvent.id || null);
    } else {
      const baseDate = selectedDate ? new Date(selectedDate) : new Date();
      setKind(initialKind === "coach" ? "coach" : "normal");
      setClient(initialKind === "coach" && initialClient ? initialClient : null);
      setTitle("");
      setDateStr(formatDate(baseDate));
      setStartTimeStr("09:00");
      setEndTimeStr("10:00");
      setAllDay(false);
      setModality("otro");
      setColor(DEFAULT_EVENT_COLOR);
      setReminderMinutes(30);
      setTotalAmount("");
      setPaidAmount("");
      setExistingAttachments([]);
      setSavedEventId(null);
    }
    setRemovedAttachments([]);
    setPendingFiles([]);
    setSubmitPhase("idle");
    setSuccessMessage(null);
    setWarningMessage(null);
    setError(null);
  }, [editingEvent, isEdit, selectedDate, initialKind, initialClient?.code]);

  const handleAddFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: PendingFile[] = [];
    for (const file of Array.from(files)) {
      try {
        storageService.validateFile(file);
        next.push({
          id: `${Date.now()}-${Math.round(Math.abs(file.size + file.name.length))}-${next.length}`,
          file,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Uno de los archivos no es válido.");
      }
    }
    if (next.length > 0) {
      setPendingFiles((prev) => [...prev, ...next]);
      setError(null);
    }
  };

  const removePending = (id: string) => {
    setPendingFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const removeExisting = (attachment: EventAttachment) => {
    setExistingAttachments((prev) => prev.filter((item) => item.path !== attachment.path));
    setRemovedAttachments((prev) => [...prev, attachment]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setSubmitPhase("saving");
    setError(null);
    setSuccessMessage(null);
    setWarningMessage(null);

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Debes iniciar sesión para crear eventos.");
      if (!workspaceId) throw new Error("Selecciona una agenda antes de crear el evento.");
      if (kind === "coach" && !client) throw new Error("Elige o crea la persona de la sesión coach.");
      const finalTitle = kind === "coach" ? (client?.name || "").trim() : title.trim();
      if (!finalTitle) throw new Error("Escribe un título para el evento.");

      const startAt = allDay ? new Date(`${dateStr}T00:00`) : new Date(`${dateStr}T${startTimeStr}`);
      const endAt = allDay ? new Date(`${dateStr}T23:59`) : new Date(`${dateStr}T${endTimeStr}`);

      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        throw new Error("Revisa la fecha y las horas del evento.");
      }
      if (!allDay && endAt <= startAt) {
        throw new Error("La hora final debe ser posterior a la hora de inicio.");
      }

      const baseData = {
        workspaceId,
        title: finalTitle,
        startAt,
        endAt,
        allDay,
        color,
        modality,
        kind,
        clientCode: kind === "coach" ? client?.code ?? null : null,
        clientName: kind === "coach" ? client?.name ?? null : null,
        reminderMinutes: Number(reminderMinutes) || null,
        totalAmount: parseMoneyInput(totalAmount),
        paidAmount: parseMoneyInput(paidAmount),
        attachments: existingAttachments,
        done: editingEvent?.done ?? false,
        createdBy: uid,
        createdByName: profile?.name || ""
      } satisfies Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">;

      let eventId = isEdit && editingEvent?.id ? editingEvent.id : savedEventId;

      if (eventId) {
        await onUpdateEvent(eventId, baseData);
      } else {
        const result = await onCreateEvent(baseData);
        eventId = result.id;
        setSavedEventId(result.id);
        if (result.syncWarning) setWarningMessage(result.syncWarning);
      }

      if (!eventId) throw new Error("No pudimos confirmar el identificador del evento.");

      // Borrar adjuntos eliminados del almacenamiento.
      await Promise.all(removedAttachments.map((att) => att.path && storageService.deleteAttachment(att.path)));
      setRemovedAttachments([]);

      // Subir archivos nuevos. Persistimos lo que sí se sube, aunque alguno falle,
      // para no dejar archivos huérfanos ni re-subir lo ya subido al reintentar.
      if (pendingFiles.length > 0) {
        setSubmitPhase("uploading");
        const uploaded: EventAttachment[] = [];
        const remaining = [...pendingFiles];

        try {
          for (const item of pendingFiles) {
            const att = await storageService.uploadAttachment(item.file, workspaceId, eventId);
            uploaded.push(att);
            const idx = remaining.findIndex((r) => r.id === item.id);
            if (idx >= 0) remaining.splice(idx, 1);
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          }
          const finalAttachments = [...existingAttachments, ...uploaded];
          await onUpdateEvent(eventId, { attachments: finalAttachments });
          setExistingAttachments(finalAttachments);
          setPendingFiles([]);
        } catch (uploadError) {
          console.error("Attachment upload failed", uploadError);
          // Guardamos los que sí se subieron para que queden referenciados.
          const partial = [...existingAttachments, ...uploaded];
          try {
            await onUpdateEvent(eventId, { attachments: partial });
          } catch (persistError) {
            console.error("No se pudo guardar adjuntos parciales", persistError);
          }
          setExistingAttachments(partial);
          setPendingFiles(remaining); // al reintentar solo se suben los que faltan
          setSuccessMessage("Evento guardado");
          setWarningMessage(
            uploadError instanceof Error
              ? `El evento se guardó. Un archivo no se pudo subir: ${uploadError.message} Toca "Intentar de nuevo" para reintentar solo ese archivo.`
              : "El evento se guardó, pero un archivo no se pudo subir. Toca \"Intentar de nuevo\"."
          );
          setSubmitPhase("error");
          return;
        }
      }

      setSuccessMessage("Evento guardado");
      setSubmitPhase("saved");
      window.setTimeout(() => setActivePage("dashboard"), 850);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "No pudimos guardar el evento.");
      setSubmitPhase("error");
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const totalAttachments = existingAttachments.length + pendingFiles.length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => setActivePage("dashboard")} className="btn-secondary min-h-11 px-3" aria-label="Volver">
          <ArrowLeft size={17} />
        </button>
        <div>
          <p className="section-label mb-2">{isEdit ? "Editar" : "Crear"}{workspaceName ? ` · ${workspaceName}` : ""}</p>
          <h2 className="m-0 text-3xl font-black tracking-tight text-app-strong">{isEdit ? "Editar evento" : "Nuevo evento"}</h2>
          <p className="mt-2 text-sm text-app-muted">Agenda una sesión, reunión o recordatorio sin complicarte.</p>
        </div>
      </div>

      {(error || successMessage || warningMessage) && (
        <div className="space-y-3">
          {successMessage && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-600">
              <CheckCircle2 size={18} />
              {successMessage}
            </div>
          )}
          {warningMessage && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm font-bold text-amber-600">{warningMessage}</div>
          )}
          {error && <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm font-bold text-red-500">{error}</div>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-5">
          <FormSection title="Datos del evento" icon={<CalendarDays size={18} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <span className="section-label mb-2 block">Tipo</span>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setKind("normal")} className={modeBtnClass(kind === "normal")}>
                    <CalendarRange size={16} /> Evento normal
                  </button>
                  <button type="button" onClick={() => setKind("coach")} className={modeBtnClass(kind === "coach")}>
                    <HeartHandshake size={16} /> Sesión coach
                  </button>
                </div>
              </div>

              {kind === "normal" ? (
                <label className="md:col-span-2">
                  <span className="section-label mb-2 block">Título</span>
                  <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reunión, Recordatorio…" autoFocus />
                </label>
              ) : (
                <div className="md:col-span-2">
                  <span className="section-label mb-2 block">Persona de la sesión</span>
                  <ClientPicker clients={clients} value={client} onSelect={setClient} onCreate={onCreateClient} />
                </div>
              )}

              <div className="md:col-span-2">
                <span className="section-label mb-2 block">Color</span>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setColor(preset.value)}
                      aria-label={preset.label}
                      title={preset.label}
                      className={`h-9 w-9 rounded-full border-2 transition ${color === preset.value ? "scale-110 border-app-strong" : "border-transparent"}`}
                      style={{ backgroundColor: preset.value }}
                    />
                  ))}
                  <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-app-soft" title="Color personalizado">
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    <span className="flex h-full w-full items-center justify-center text-app-faint">+</span>
                  </label>
                </div>
              </div>

              <label>
                <span className="section-label mb-2 block">Fecha</span>
                <input className="input-field" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} required />
              </label>

              <label>
                <span className="section-label mb-2 block">Modalidad</span>
                <select className="input-field" value={modality} onChange={(e) => setModality(e.target.value as EventModality)}>
                  {MODALITY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <label>
                  <span className="section-label mb-2 block">Inicio</span>
                  <input className="input-field" type="time" value={startTimeStr} onChange={(e) => setStartTimeStr(e.target.value)} disabled={allDay} required={!allDay} />
                </label>
                <label>
                  <span className="section-label mb-2 block">Final</span>
                  <input className="input-field" type="time" value={endTimeStr} onChange={(e) => setEndTimeStr(e.target.value)} disabled={allDay} required={!allDay} />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-app-soft bg-app-soft p-4 md:col-span-2">
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-5 w-5 accent-amber-500" />
                <span className="text-sm font-bold text-app-muted">Todo el día</span>
              </label>
            </div>
          </FormSection>

          <FormSection title="Pagos (opcional)">
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="section-label mb-2 block">Valor total de lo que compró</span>
                <input className="input-field" inputMode="numeric" min="0" step="1" type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="Ej. 278000" />
              </label>
              <label>
                <span className="section-label mb-2 block">Valor abonado</span>
                <input className="input-field" inputMode="numeric" min="0" step="1" type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="Ej. 100000" />
              </label>
            </div>
          </FormSection>

          <FormSection title="Imágenes y documentos" icon={<Paperclip size={18} />}>
            <div className="space-y-3">
              {attachmentsEnabled ? (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-app-soft bg-app-soft px-4 py-7 text-center transition hover:border-app-strong">
                  <Upload size={28} className="mb-2 text-app-accent" />
                  <span className="text-sm font-bold text-app-muted">Toca para agregar archivos</span>
                  <span className="mt-1 text-xs text-app-faint">Imágenes, PDF, Word, Excel, PowerPoint o texto. Hasta 15 MB cada uno.</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.zip"
                    className="hidden"
                    onChange={(e) => {
                      handleAddFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : (
                <div className="rounded-3xl border border-dashed border-app-soft bg-app-soft px-4 py-6 text-center">
                  <Paperclip size={24} className="mx-auto mb-2 text-app-faint" />
                  <p className="m-0 text-sm font-bold text-app-muted">Adjuntar archivos aún no está activo</p>
                  <p className="m-0 mt-1 text-xs text-app-faint">Falta terminar la configuración de Cloudinary.</p>
                </div>
              )}

              {totalAttachments === 0 ? (
                <p className="m-0 text-center text-xs text-app-faint">Sin archivos adjuntos todavía.</p>
              ) : (
                <ul className="space-y-2">
                  {existingAttachments.map((att) => (
                    <AttachmentRow
                      key={att.path || att.url}
                      name={att.name}
                      sizeLabel={att.size ? formatBytes(att.size) : "Guardado"}
                      isImage={att.kind === "image"}
                      previewUrl={att.kind === "image" ? att.url : undefined}
                      onRemove={() => removeExisting(att)}
                    />
                  ))}
                  {pendingFiles.map((item) => (
                    <AttachmentRow
                      key={item.id}
                      name={item.file.name}
                      sizeLabel={`${formatBytes(item.file.size)} · nuevo`}
                      isImage={item.file.type.startsWith("image/")}
                      previewUrl={item.previewUrl}
                      onRemove={() => removePending(item.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </FormSection>
        </div>

        <aside className="space-y-5 pb-28 lg:pb-0">
          <FormSection title="Recordatorio">
            <label className="block">
              <span className="section-label mb-2 block">Recordatorio</span>
              <select className="input-field" value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))}>
                {REMINDER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </FormSection>

          <div className="hidden flex-col gap-3 lg:flex">
            <button type="submit" disabled={submitDisabled} className="btn-primary w-full">
              {isBusy ? <Spinner className="h-5 w-5" /> : submitPhase === "error" ? <RotateCcw size={17} /> : submitPhase === "saved" ? <CheckCircle2 size={17} /> : <Save size={17} />}
              {submitLabel}
            </button>
            <button type="button" onClick={() => setActivePage("dashboard")} className="btn-secondary w-full">
              <X size={17} />
              Cancelar
            </button>
          </div>
        </aside>

        <div className="fixed bottom-[76px] left-0 right-0 z-40 border-t border-app-soft bg-app-panel p-3 shadow-2xl backdrop-blur-xl lg:hidden">
          {(error || warningMessage) && (
            <p className={`mb-2 line-clamp-2 text-xs font-bold ${error ? "text-red-500" : "text-amber-600"}`}>{error || warningMessage}</p>
          )}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button type="submit" disabled={submitDisabled} className="btn-primary min-h-12">
              {isBusy ? <Spinner className="h-5 w-5" /> : submitPhase === "error" ? <RotateCcw size={17} /> : submitPhase === "saved" ? <CheckCircle2 size={17} /> : <Save size={17} />}
              {submitLabel}
            </button>
            <button type="button" onClick={() => setActivePage("dashboard")} className="btn-secondary min-h-12 px-4" aria-label="Cancelar">
              <X size={17} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function AttachmentRow({
  name,
  sizeLabel,
  isImage,
  previewUrl,
  onRemove
}: {
  name: string;
  sizeLabel: string;
  isImage: boolean;
  previewUrl?: string;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-app-soft bg-app-panel p-2.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-app-soft text-app-accent">
        {isImage && previewUrl ? (
          <img src={previewUrl} alt={name} className="h-full w-full object-cover" />
        ) : isImage ? (
          <ImageIcon size={20} />
        ) : (
          <FileText size={20} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm font-bold text-app-strong">{name}</p>
        <p className="m-0 text-xs text-app-faint">{sizeLabel}</p>
      </div>
      <button type="button" onClick={onRemove} className="rounded-xl p-2 text-app-faint hover:bg-red-500/10 hover:text-red-500" aria-label="Quitar archivo">
        <Trash2 size={16} />
      </button>
    </li>
  );
}

function FormSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-app-accent">{icon}</span>}
        <h3 className="m-0 text-lg font-black text-app-strong">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

function ClientPicker({
  clients,
  value,
  onSelect,
  onCreate
}: {
  clients: Client[];
  value: { code: number; name: string } | null;
  onSelect: (c: { code: number; name: string } | null) => void;
  onCreate: (name: string) => Promise<Client>;
}) {
  const [query, setQuery] = useState(value?.name || "");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setQuery(value?.name || "");
  }, [value?.code]);

  const q = normalizeText(query);
  const matches = useMemo(() => {
    if (!q) return clients.slice(0, 8);
    return clients.filter((c) => c.nameLower.includes(q)).slice(0, 8);
  }, [clients, q]);
  const exact = clients.some((c) => normalizeText(c.name) === q);

  const handleCreate = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    setErr(null);
    try {
      const created = await onCreate(name);
      onSelect({ code: created.code, name: created.name });
      setQuery(created.name);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo crear la persona.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-0 top-3.5 flex items-center pl-4 text-app-faint">
        <Search size={16} />
      </span>
      <input
        className="input-field pl-11"
        value={query}
        placeholder="Escribe el nombre de la persona..."
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onSelect(null);
        }}
      />
      {value && (
        <p className="m-0 mt-2 inline-flex items-center gap-2 rounded-full border border-app-soft bg-app-soft px-3 py-1 text-xs font-black text-app-accent">
          <UserRound size={13} /> {value.name} · #{value.code}
        </p>
      )}
      {err && <p className="m-0 mt-2 text-xs font-bold text-red-500">{err}</p>}
      {open && (
        <div className="glass-panel absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl p-1.5">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect({ code: c.code, name: c.name });
                setQuery(c.name);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-app-muted hover:bg-app-soft hover:text-app-strong"
            >
              <span className="truncate">{c.name}</span>
              <span className="ml-auto shrink-0 text-xs text-app-faint">#{c.code}</span>
            </button>
          ))}
          {query.trim() && !exact && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
              disabled={creating}
              className="flex w-full items-center gap-2 rounded-xl border-t border-app-soft px-3 py-2 text-left text-sm font-black text-app-accent hover:bg-app-soft"
            >
              <Plus size={15} /> {creating ? "Creando..." : `Crear "${query.trim()}"`}
            </button>
          )}
          {matches.length === 0 && !query.trim() && (
            <p className="m-0 px-3 py-2 text-xs text-app-faint">Aún no hay personas. Escribe un nombre para crear la primera.</p>
          )}
        </div>
      )}
    </div>
  );
}

function getSubmitLabel(phase: "idle" | "saving" | "uploading" | "saved" | "error") {
  if (phase === "saving") return "Guardando evento...";
  if (phase === "uploading") return "Subiendo archivos...";
  if (phase === "saved") return "Evento guardado";
  if (phase === "error") return "Intentar de nuevo";
  return "Guardar evento";
}

function parseMoneyInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoneyInput(value?: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
