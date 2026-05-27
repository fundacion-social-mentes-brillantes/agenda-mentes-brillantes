import React, { useState, useEffect } from "react";
import type { CalendarEvent, EventModality, EventStatus, EventType } from "../types/event";
import type { UserProfile } from "../types/user";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { ArrowLeft, Save, X } from "lucide-react";

interface EventFormPageProps {
  editingEvent: CalendarEvent | null;
  selectedDate: Date | null;
  profile: UserProfile | null;
  setActivePage: (page: string) => void;
  onCreateEvent: (eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  onUpdateEvent: (id: string, eventData: Partial<CalendarEvent>) => Promise<void>;
}

export default function EventFormPage({
  editingEvent,
  selectedDate,
  profile,
  setActivePage,
  onCreateEvent,
  onUpdateEvent
}: EventFormPageProps) {
  const isEdit = !!editingEvent;

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<EventType>("session");
  const [status, setStatus] = useState<EventStatus>("scheduled");
  const [dateStr, setDateStr] = useState("");
  const [startTimeStr, setStartTimeStr] = useState("09:00");
  const [endTimeStr, setEndTimeStr] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState("#3b82f6");
  const [clientName, setClientName] = useState("");
  const [personInCharge, setPersonInCharge] = useState("");
  const [modality, setModality] = useState<EventModality>("virtual");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState<number>(15);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Type to Color helper
  const getColorForType = (evtType: EventType): string => {
    const colors = {
      session: "#3b82f6",     // Blue
      task: "#8b5cf6",        // Purple
      reminder: "#d97706",    // Amber/Gold
      family: "#10b981",      // Green
      foundation: "#f472b6"   // Pink
    };
    return colors[evtType];
  };

  // Update color automatically when type changes
  useEffect(() => {
    if (!isEdit) {
      setColor(getColorForType(type));
    }
  }, [type, isEdit]);

  // Load editing event or defaults
  useEffect(() => {
    // Helper to format date as YYYY-MM-DD
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // Helper to format time as HH:MM
    const formatTime = (date: Date) => {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    };

    if (isEdit && editingEvent) {
      const start = new Date(editingEvent.startAt as Date);
      const end = new Date(editingEvent.endAt as Date);
      
      setTitle(editingEvent.title);
      setDescription(editingEvent.description || "");
      setType(editingEvent.type);
      setStatus(editingEvent.status);
      setDateStr(formatDate(start));
      setStartTimeStr(formatTime(start));
      setEndTimeStr(formatTime(end));
      setAllDay(editingEvent.allDay);
      setColor(editingEvent.color);
      setClientName(editingEvent.clientName || "");
      setPersonInCharge(editingEvent.personInCharge);
      setModality(editingEvent.modality);
      setLocation(editingEvent.location || "");
      setMeetingLink(editingEvent.meetingLink || "");
      setReminderMinutes(editingEvent.reminderMinutes || 15);
      setNotes(editingEvent.notes || "");
    } else {
      // Default creation state
      const baseDate = selectedDate ? new Date(selectedDate) : new Date();
      setDateStr(formatDate(baseDate));
      setStartTimeStr("09:00");
      setEndTimeStr("10:00");
      setPersonInCharge(profile?.name || "");
      setTitle("");
      setDescription("");
      setType("session");
      setStatus("scheduled");
      setAllDay(false);
      setClientName("");
      setModality("virtual");
      setLocation("");
      setMeetingLink("");
      setReminderMinutes(15);
      setNotes("");
    }
  }, [editingEvent, isEdit, selectedDate, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate inputs
    if (!title.trim()) {
      setError("El título es obligatorio");
      setLoading(false);
      return;
    }

    if (!personInCharge.trim()) {
      setError("El responsable es obligatorio");
      setLoading(false);
      return;
    }

    try {
      // Parse dates
      const startAt = new Date(`${dateStr}T${startTimeStr}`);
      const endAt = new Date(`${dateStr}T${endTimeStr}`);

      if (endAt <= startAt) {
        throw new Error("La hora de finalización debe ser posterior a la de inicio.");
      }

      const eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt"> = {
        title,
        description,
        type,
        status,
        startAt,
        endAt,
        allDay,
        color,
        clientName: type === "session" ? clientName : "",
        personInCharge,
        modality,
        location,
        meetingLink,
        reminderMinutes: Number(reminderMinutes),
        notes,
        createdBy: profile?.uid || "unknown"
      };

      if (isEdit && editingEvent) {
        await onUpdateEvent(editingEvent.id!, eventData);
      } else {
        await onCreateEvent(eventData);
      }

      setActivePage("dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al guardar el evento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setActivePage("dashboard")}
          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white m-0">
            {isEdit ? "Editar Evento" : "Nuevo Evento"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isEdit ? "Modifica los detalles del evento existente." : "Registra una nueva actividad en el calendario de Mentes Brillantes."}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm font-semibold">
          {error}
        </div>
      )}

      {/* Main Form */}
      <Card className="max-w-3xl">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Title */}
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Título del Evento *
            </label>
            <input
              type="text"
              placeholder="Ej. Sesión Coaching Juan Pérez"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all"
              required
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tipo de Evento
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all capitalize"
            >
              <option value="session">Sesión Coach</option>
              <option value="task">Tarea Interna</option>
              <option value="reminder">Recordatorio</option>
              <option value="family">Actividad Familiar</option>
              <option value="foundation">Actividad Fundación</option>
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Estado
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all capitalize"
            >
              <option value="scheduled">Programado</option>
              <option value="confirmed">Confirmado</option>
              <option value="completed">Completado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          {/* Client Name (Show only if Coach Session) */}
          {type === "session" && (
            <div className="col-span-2 md:col-span-1 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Nombre del Cliente *
              </label>
              <input
                type="text"
                placeholder="Ej. Juan Pérez"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all"
                required={type === "session"}
              />
            </div>
          )}

          {/* Person In Charge (Coach or Family Member) */}
          <div className={`col-span-2 ${type === "session" ? "md:col-span-1" : ""} flex flex-col gap-1.5`}>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Responsable / Coach *
            </label>
            <input
              type="text"
              placeholder="Nombre del responsable"
              value={personInCharge}
              onChange={(e) => setPersonInCharge(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all"
              required
            />
          </div>

          {/* Description */}
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Descripción
            </label>
            <textarea
              placeholder="Detalles sobre el evento..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all resize-none"
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Fecha *
            </label>
            <div className="relative">
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all"
                required
              />
            </div>
          </div>

          {/* Times Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Inicio *
              </label>
              <input
                type="time"
                value={startTimeStr}
                onChange={(e) => setStartTimeStr(e.target.value)}
                disabled={allDay}
                className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all disabled:opacity-50"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Fin *
              </label>
              <input
                type="time"
                value={endTimeStr}
                onChange={(e) => setEndTimeStr(e.target.value)}
                disabled={allDay}
                className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all disabled:opacity-50"
                required
              />
            </div>
          </div>

          {/* All Day Checkbox & Customized Color */}
          <div className="flex items-center justify-between p-2 col-span-2 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/40">
            <div className="flex items-center gap-2">
              <input
                id="allDay"
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="w-4 h-4 text-violet-600 border-slate-350 rounded-md focus:ring-violet-500"
              />
              <label htmlFor="allDay" className="text-xs font-bold text-slate-650 dark:text-slate-350 cursor-pointer select-none">
                ¿Todo el día?
              </label>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="color" className="text-xs font-bold text-slate-400 dark:text-slate-500">
                Color
              </label>
              <input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 p-0 bg-transparent rounded-lg border-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Modality */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Modalidad
            </label>
            <select
              value={modality}
              onChange={(e) => setModality(e.target.value as EventModality)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all capitalize"
            >
              <option value="virtual">Virtual (Zoom/Teams)</option>
              <option value="presencial">Presencial (Oficina/Lugar)</option>
              <option value="llamada">Llamada Telefónica</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          {/* Reminder Minutes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Recordatorio (Minutos antes)
            </label>
            <input
              type="number"
              min="0"
              placeholder="15"
              value={reminderMinutes}
              onChange={(e) => setReminderMinutes(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all"
            />
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ubicación física / Dirección
            </label>
            <input
              type="text"
              placeholder="Ej. Calle 10 # 5-40"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all"
            />
          </div>

          {/* Meeting Link */}
          <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Enlace de la sesión (Reunión Virtual)
            </label>
            <input
              type="url"
              placeholder="https://zoom.us/j/..."
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all"
            />
          </div>

          {/* Notes */}
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Notas Adicionales
            </label>
            <textarea
              placeholder="Observaciones, recordatorios de temas a tratar..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 focus:border-violet-500 outline-none text-sm transition-all resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="col-span-2 flex gap-3 border-t border-slate-100 dark:border-slate-800/40 pt-4 mt-2 justify-end">
            <button
              type="button"
              onClick={() => setActivePage("dashboard")}
              className="flex items-center gap-1.5 py-3 px-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 text-sm font-semibold transition-all active:scale-98"
            >
              <X size={16} />
              <span>Cancelar</span>
            </button>
            
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 py-3 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm shadow-md shadow-violet-500/20 active:scale-98 transition-all disabled:opacity-50"
            >
              {loading ? (
                <Spinner className="w-5 h-5 text-white" />
              ) : (
                <>
                  <Save size={16} />
                  <span>Guardar Evento</span>
                </>
              )}
            </button>
          </div>

        </form>
      </Card>
    </div>
  );
}
