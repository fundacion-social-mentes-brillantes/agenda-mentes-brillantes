import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Image as ImageIcon, RotateCcw, Save, Trash2, Upload, X } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { EVENT_STATUS_OPTIONS, EVENT_TYPE_OPTIONS, PRIORITY_OPTIONS, REMINDER_OPTIONS, getEventMeta } from "../lib/eventMeta";
import { auth } from "../lib/firebase";
import { storageService } from "../services/storageService";
import type { EventWriteResult } from "../services/eventsService";
import type { CalendarEvent, EventModality, EventPriority, EventStatus, EventType } from "../types/event";
import type { UserProfile } from "../types/user";

interface EventFormPageProps {
  editingEvent: CalendarEvent | null;
  selectedDate: Date | null;
  initialType?: EventType | null;
  profile: UserProfile | null;
  setActivePage: (page: string) => void;
  onCreateEvent: (eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">) => Promise<EventWriteResult>;
  onUpdateEvent: (id: string, eventData: Partial<CalendarEvent>) => Promise<void>;
}

export default function EventFormPage({
  editingEvent,
  selectedDate,
  initialType,
  profile,
  setActivePage,
  onCreateEvent,
  onUpdateEvent
}: EventFormPageProps) {
  const isEdit = !!editingEvent;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<EventType>(initialType || "meeting");
  const [status, setStatus] = useState<EventStatus>("scheduled");
  const [priority, setPriority] = useState<EventPriority>("medium");
  const [dateStr, setDateStr] = useState("");
  const [startTimeStr, setStartTimeStr] = useState("09:00");
  const [endTimeStr, setEndTimeStr] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState(getEventMeta(initialType || "meeting").color);
  const [personInCharge, setPersonInCharge] = useState("");
  const [participants, setParticipants] = useState("");
  const [modality, setModality] = useState<EventModality>("virtual");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState<number>(30);
  const [notes, setNotes] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<"idle" | "saving" | "uploading" | "saved" | "error">("idle");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const typeMeta = useMemo(() => getEventMeta(type), [type]);
  const isBusy = submitPhase === "saving" || submitPhase === "uploading";
  const submitLabel = getSubmitLabel(submitPhase);
  const submitDisabled = isBusy || submitPhase === "saved";

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

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
      setTitle(editingEvent.title || "");
      setDescription(editingEvent.description || "");
      setType(editingEvent.type || "other");
      setStatus(editingEvent.status || "scheduled");
      setPriority(editingEvent.priority || "medium");
      setDateStr(formatDate(start));
      setStartTimeStr(formatTime(start));
      setEndTimeStr(formatTime(end));
      setAllDay(!!editingEvent.allDay);
      setColor(editingEvent.color || getEventMeta(editingEvent.type).color);
      setPersonInCharge(editingEvent.personInCharge || profile?.name || "");
      setParticipants(editingEvent.participants || editingEvent.clientName || "");
      setModality(editingEvent.modality || "virtual");
      setLocation(editingEvent.location || "");
      setMeetingLink(editingEvent.meetingLink || "");
      setReminderMinutes(editingEvent.reminderMinutes ?? 30);
      setNotes(editingEvent.notes || "");
      setTotalAmount(formatMoneyInput(editingEvent.totalAmount));
      setPaidAmount(formatMoneyInput(editingEvent.paidAmount));
      setExistingImageUrl(editingEvent.imageUrl || null);
      setExistingImagePath(editingEvent.imagePath || null);
      setImageFile(null);
      setImagePreview(null);
      setRemoveExistingImage(false);
      setSubmitPhase("idle");
      setSuccessMessage(null);
      setWarningMessage(null);
      setError(null);
      setSavedEventId(editingEvent.id || null);
      return;
    }

    const baseDate = selectedDate ? new Date(selectedDate) : new Date();
    const defaultType = initialType || "meeting";
    setTitle("");
    setDescription("");
    setType(defaultType);
    setStatus("scheduled");
    setPriority("medium");
    setDateStr(formatDate(baseDate));
    setStartTimeStr("09:00");
    setEndTimeStr("10:00");
    setAllDay(false);
    setColor(getEventMeta(defaultType).color);
    setPersonInCharge(profile?.name || "");
    setParticipants("");
    setModality(defaultType === "meeting" || defaultType === "session" ? "virtual" : "otro");
    setLocation("");
    setMeetingLink("");
    setReminderMinutes(defaultType === "reminder" ? 10 : 30);
    setNotes("");
    setTotalAmount("");
    setPaidAmount("");
    setExistingImageUrl(null);
    setExistingImagePath(null);
    setImageFile(null);
    setImagePreview(null);
    setRemoveExistingImage(false);
    setSubmitPhase("idle");
    setSuccessMessage(null);
    setWarningMessage(null);
    setError(null);
    setSavedEventId(null);
  }, [editingEvent, initialType, isEdit, profile, selectedDate]);

  const handleTypeChange = (nextType: EventType) => {
    setType(nextType);
    setColor(getEventMeta(nextType).color);
  };

  const handleImageChange = (file: File | null) => {
    if (!file) return;
    try {
      storageService.validateImage(file);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setRemoveExistingImage(false);
      setError(null);
      setWarningMessage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La imagen no es valida.");
      setSubmitPhase("error");
    }
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (existingImageUrl) setRemoveExistingImage(true);
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
      if (!uid) {
        throw new Error("Debes iniciar sesión para crear eventos.");
      }

      if (!title.trim()) {
        throw new Error("Escribe un titulo para el evento.");
      }

      if (!personInCharge.trim()) {
        throw new Error("Indica quien es responsable.");
      }

      const startAt = allDay ? new Date(`${dateStr}T00:00`) : new Date(`${dateStr}T${startTimeStr}`);
      const endAt = allDay ? new Date(`${dateStr}T23:59`) : new Date(`${dateStr}T${endTimeStr}`);

      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        throw new Error("Revisa la fecha y las horas del evento.");
      }

      if (!allDay && endAt <= startAt) {
        throw new Error("La hora final debe ser posterior a la hora de inicio.");
      }

      const eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt"> = {
        title: title.trim(),
        description: description.trim(),
        type,
        status,
        priority,
        startAt,
        endAt,
        allDay,
        color,
        clientName: type === "session" ? participants.trim() : "",
        participants: participants.trim(),
        personInCharge: personInCharge.trim(),
        modality,
        location: location.trim(),
        meetingLink: meetingLink.trim(),
        reminderMinutes: Number(reminderMinutes) || null,
        notes: notes.trim(),
        totalAmount: type === "session" ? parseMoneyInput(totalAmount) : null,
        paidAmount: type === "session" ? parseMoneyInput(paidAmount) : null,
        currency: type === "session" ? "COP" : undefined,
        imageUrl: removeExistingImage ? null : existingImageUrl,
        imagePath: removeExistingImage ? null : existingImagePath,
        createdBy: uid
      };

      let eventId = isEdit && editingEvent?.id ? editingEvent.id : savedEventId;

      if (eventId) {
        await onUpdateEvent(eventId, eventData);
      } else {
        const createResult = await onCreateEvent(eventData);
        eventId = createResult.id;
        setSavedEventId(createResult.id);
        if (createResult.syncWarning) {
          setWarningMessage(createResult.syncWarning);
        }
      }

      if (!eventId) {
        throw new Error("No pudimos confirmar el identificador del evento.");
      }

      if (removeExistingImage && existingImagePath) {
        await storageService.deleteEventImage(existingImagePath);
      }

      if (imageFile) {
        setSubmitPhase("uploading");
        try {
          const upload = await storageService.uploadEventImage(imageFile, eventId, uid);
          await onUpdateEvent(eventId, upload);
        } catch (imageError) {
          console.error("Event image upload failed", imageError);
          setSuccessMessage("Evento guardado");
          setWarningMessage("El evento se guardó, pero la imagen no pudo subirse.");
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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => setActivePage("dashboard")} className="btn-secondary min-h-11 px-3" aria-label="Volver">
          <ArrowLeft size={17} />
        </button>
        <div>
          <p className="section-label mb-2">{isEdit ? "Editar" : "Crear"}</p>
          <h2 className="m-0 text-3xl font-black tracking-tight text-app-strong">{isEdit ? "Editar evento" : "Nuevo evento"}</h2>
          <p className="mt-2 text-sm text-app-muted">Agenda reuniones, tareas, sesiones, pagos, salud y recordatorios sin complicarte.</p>
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
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm font-bold text-amber-600">
              {warningMessage}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm font-bold text-red-500">
              {error}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <FormSection title="Basico" icon={<CalendarDays size={18} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="section-label mb-2 block">Titulo</span>
                <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Reunion familiar, pago, tarea o sesion" required />
              </label>

              <label>
                <span className="section-label mb-2 block">Tipo de evento</span>
                <select className="input-field" value={type} onChange={(e) => handleTypeChange(e.target.value as EventType)}>
                  {EVENT_TYPE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <p className="m-0 mt-2 text-xs text-app-faint">{typeMeta.description}</p>
              </label>

              <label>
                <span className="section-label mb-2 block">Responsable</span>
                <input className="input-field" value={personInCharge} onChange={(e) => setPersonInCharge(e.target.value)} placeholder="Nombre del responsable" required />
              </label>

              <label>
                <span className="section-label mb-2 block">Fecha</span>
                <input className="input-field" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} required />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="section-label mb-2 block">Inicio</span>
                  <input className="input-field" type="time" value={startTimeStr} onChange={(e) => setStartTimeStr(e.target.value)} disabled={allDay} required />
                </label>
                <label>
                  <span className="section-label mb-2 block">Final</span>
                  <input className="input-field" type="time" value={endTimeStr} onChange={(e) => setEndTimeStr(e.target.value)} disabled={allDay} required />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-app-soft bg-app-soft p-4 md:col-span-2">
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-5 w-5 accent-amber-500" />
                <span className="text-sm font-bold text-app-muted">Todo el dia</span>
              </label>
            </div>
          </FormSection>

          {type === "session" && (
            <FormSection title="Información de la sesión">
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="section-label mb-2 block">Valor total de lo que compró</span>
                  <input
                    className="input-field"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="Ej. 278000"
                  />
                </label>
                <label>
                  <span className="section-label mb-2 block">Valor abonado</span>
                  <input
                    className="input-field"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="Ej. 100000"
                  />
                </label>
              </div>
            </FormSection>
          )}

          <FormSection title="Detalles">
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="section-label mb-2 block">Participantes o persona relacionada</span>
                <input className="input-field" value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="Familia, cliente, equipo o persona" />
              </label>
              <label>
                <span className="section-label mb-2 block">Modalidad</span>
                <select className="input-field" value={modality} onChange={(e) => setModality(e.target.value as EventModality)}>
                  <option value="virtual">Virtual</option>
                  <option value="presencial">Presencial</option>
                  <option value="llamada">Llamada</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
              <label>
                <span className="section-label mb-2 block">Ubicacion</span>
                <input className="input-field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lugar o direccion" />
              </label>
              <label>
                <span className="section-label mb-2 block">Enlace de reunion</span>
                <input className="input-field" type="url" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://..." />
              </label>
              <label className="md:col-span-2">
                <span className="section-label mb-2 block">Descripcion breve</span>
                <textarea className="input-field min-h-24 resize-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Una linea clara para entender el evento." />
              </label>
              <label className="md:col-span-2">
                <span className="section-label mb-2 block">Notas</span>
                <textarea className="input-field min-h-28 resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalles, acuerdos, pendientes o contexto." />
              </label>
            </div>
          </FormSection>
        </div>

        <aside className="space-y-5 pb-28 lg:pb-0">
          <FormSection title="Estado">
            <div className="space-y-4">
              <label>
                <span className="section-label mb-2 block">Estado</span>
                <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}>
                  {EVENT_STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="section-label mb-2 block">Prioridad</span>
                <select className="input-field" value={priority} onChange={(e) => setPriority(e.target.value as EventPriority)}>
                  {PRIORITY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="section-label mb-2 block">Recordatorio</span>
                <select className="input-field" value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))}>
                  {REMINDER_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="section-label mb-2 block">Color</span>
                <input className="h-12 w-full cursor-pointer rounded-2xl border border-app-soft bg-app-soft p-1" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </label>
            </div>
          </FormSection>

          <FormSection title="Imagen">
            <div className="space-y-3">
              {(imagePreview || (existingImageUrl && !removeExistingImage)) ? (
                <div className="overflow-hidden rounded-3xl border border-app-soft bg-app-soft">
                  <img src={imagePreview || existingImageUrl || ""} alt="Vista previa" className="h-48 w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-36 flex-col items-center justify-center rounded-3xl border border-dashed border-app-soft bg-app-soft text-center sm:h-48">
                  <ImageIcon size={34} className="mb-2 text-app-accent" />
                  <p className="m-0 text-sm font-bold text-app-muted">Imagen opcional</p>
                  <p className="m-0 mt-1 text-xs text-app-faint">JPG, PNG o WEBP. Maximo 5 MB.</p>
                </div>
              )}

              <label className="btn-secondary w-full">
                <Upload size={16} />
                Subir imagen
                <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(e) => handleImageChange(e.target.files?.[0] || null)} />
              </label>

              {(imagePreview || existingImageUrl) && (
                <button type="button" onClick={clearImage} className="btn-danger-soft w-full">
                  <Trash2 size={16} />
                  Quitar imagen
                </button>
              )}
            </div>
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
            <p className={`mb-2 line-clamp-2 text-xs font-bold ${error ? "text-red-500" : "text-amber-600"}`}>
              {error || warningMessage}
            </p>
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

function getSubmitLabel(phase: "idle" | "saving" | "uploading" | "saved" | "error") {
  if (phase === "saving") return "Guardando evento...";
  if (phase === "uploading") return "Subiendo imagen...";
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
