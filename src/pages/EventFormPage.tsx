import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Image as ImageIcon, Save, Trash2, Upload, X } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { EVENT_STATUS_OPTIONS, EVENT_TYPE_OPTIONS, PRIORITY_OPTIONS, REMINDER_OPTIONS, getEventMeta } from "../lib/eventMeta";
import { storageService } from "../services/storageService";
import type { CalendarEvent, EventModality, EventPriority, EventStatus, EventType } from "../types/event";
import type { UserProfile } from "../types/user";

interface EventFormPageProps {
  editingEvent: CalendarEvent | null;
  selectedDate: Date | null;
  initialType?: EventType | null;
  profile: UserProfile | null;
  setActivePage: (page: string) => void;
  onCreateEvent: (eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">) => Promise<string>;
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeMeta = useMemo(() => getEventMeta(type), [type]);

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
      setExistingImageUrl(editingEvent.imageUrl || null);
      setExistingImagePath(editingEvent.imagePath || null);
      setImageFile(null);
      setImagePreview(null);
      setRemoveExistingImage(false);
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
    setExistingImageUrl(null);
    setExistingImagePath(null);
    setImageFile(null);
    setImagePreview(null);
    setRemoveExistingImage(false);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "La imagen no es valida.");
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
    setLoading(true);
    setError(null);

    if (!title.trim()) {
      setError("Escribe un titulo para el evento.");
      setLoading(false);
      return;
    }

    if (!personInCharge.trim()) {
      setError("Indica quien es responsable.");
      setLoading(false);
      return;
    }

    try {
      const startAt = allDay ? new Date(`${dateStr}T00:00`) : new Date(`${dateStr}T${startTimeStr}`);
      const endAt = allDay ? new Date(`${dateStr}T23:59`) : new Date(`${dateStr}T${endTimeStr}`);

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
        imageUrl: removeExistingImage ? null : existingImageUrl,
        imagePath: removeExistingImage ? null : existingImagePath,
        createdBy: profile?.uid || "unknown"
      };

      const eventId = isEdit && editingEvent?.id ? editingEvent.id : await onCreateEvent(eventData);

      if (isEdit && editingEvent?.id) {
        await onUpdateEvent(editingEvent.id, eventData);
      }

      if (removeExistingImage && existingImagePath) {
        await storageService.deleteEventImage(existingImagePath);
      }

      if (imageFile) {
        const upload = await storageService.uploadEventImage(imageFile, eventId, profile?.uid || "unknown");
        await onUpdateEvent(eventId, upload);
      }

      setActivePage("dashboard");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "No pudimos guardar el evento.");
    } finally {
      setLoading(false);
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

      {error && <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm font-bold text-red-500">{error}</div>}

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

        <aside className="space-y-5">
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
                <div className="flex h-48 flex-col items-center justify-center rounded-3xl border border-dashed border-app-soft bg-app-soft text-center">
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

          <div className="flex flex-col gap-3">
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Spinner className="h-5 w-5" /> : <Save size={17} />}
              Guardar evento
            </button>
            <button type="button" onClick={() => setActivePage("dashboard")} className="btn-secondary w-full">
              <X size={17} />
              Cancelar
            </button>
          </div>
        </aside>
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

