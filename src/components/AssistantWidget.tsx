import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { auth } from "../lib/firebase";
import { toDate } from "../lib/dateUtils";
import { DEFAULT_EVENT_COLOR } from "../lib/eventMeta";
import { Spinner } from "./ui/Spinner";
import { normalizeText } from "../services/clientsService";
import type { EventWriteResult } from "../services/eventsService";
import type { CalendarEvent } from "../types/event";
import type { Client } from "../types/client";

interface UiMessage {
  role: "assistant" | "user";
  content: string;
}

interface AssistantWidgetProps {
  events: CalendarEvent[];
  clients: Client[];
  workspaceName?: string;
  workspaceId: string | null;
  userName?: string;
  onCreateEvent: (eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">) => Promise<EventWriteResult>;
  onUpdateEvent: (id: string, eventData: Partial<CalendarEvent>) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onCreateClient: (name: string) => Promise<Client>;
}

const GREETING: UiMessage = {
  role: "assistant",
  content:
    "¡Hola! Soy uno con tu agenda. Pregúntame (\"¿cuántas sesiones lleva Catalina?\") o pídeme: \"agenda sesión coach con Catalina el martes a las 3\", \"crea a la persona Juan Pérez\", \"mueve la sesión de mañana a las 4\" o \"duplica el evento al jueves\"."
};

const pad = (n: number) => String(n).padStart(2, "0");

function buildDate(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr || "09:00"}`);
}
function ev24(value: CalendarEvent["startAt"]): string {
  const d = toDate(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function evDate(value: CalendarEvent["startAt"]): string {
  const d = toDate(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function AssistantWidget({ events, clients, workspaceName, workspaceId, userName, onCreateEvent, onUpdateEvent, onDeleteEvent, onCreateClient }: AssistantWidgetProps) {
  const [open, setOpen] = useState(false);
  const [uiMessages, setUiMessages] = useState<UiMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Pensando...");
  const convoRef = useRef<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Caché de eventos creados/duplicados en ESTE turno: permite mover/duplicar/borrar
  // algo recién creado, aunque el listener de Firestore todavía no haya refrescado "events".
  const localCacheRef = useRef<CalendarEvent[]>([]);
  // Caché de personas creadas este turno (para agendar coach justo después de crearlas).
  const localClientsRef = useRef<Client[]>([]);

  const findEvent = (id: string): CalendarEvent | undefined =>
    events.find((e) => e.id === id) || localCacheRef.current.find((e) => e.id === id);

  const findClient = (codeOrName: { code?: number; name?: string }): Client | undefined => {
    const all = [...clients, ...localClientsRef.current];
    if (typeof codeOrName.code === "number") {
      const byCode = all.find((c) => c.code === codeOrName.code);
      if (byCode) return byCode;
    }
    if (codeOrName.name) {
      const q = normalizeText(codeOrName.name);
      return all.find((c) => c.nameLower === q) || all.find((c) => c.nameLower.includes(q));
    }
    return undefined;
  };

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [uiMessages, open, loading, status]);

  async function execTool(name: string, args: any): Promise<string> {
    try {
      if (name === "create_event") {
        if (!workspaceId) return "No hay agenda seleccionada.";
        const date = String(args.date || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "La fecha no es válida (formato YYYY-MM-DD).";
        const allDay = !!args.allDay;
        const start = allDay ? buildDate(date, "00:00") : buildDate(date, args.startTime || "09:00");
        // Si dan hora de fin, se usa; si solo dan hora de inicio, dura exactamente 1 hora (4 → 5, seguro al cruzar medianoche).
        const end = allDay
          ? buildDate(date, "23:59")
          : args.endTime
            ? buildDate(date, args.endTime)
            : new Date(start.getTime() + 60 * 60 * 1000);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Fecha u hora inválida.";
        const newEvent: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt"> = {
          workspaceId,
          title: String(args.title || "Evento"),
          startAt: start,
          endAt: end,
          allDay,
          color: args.color || DEFAULT_EVENT_COLOR,
          modality: args.modality === "presencial" || args.modality === "virtual" ? args.modality : "otro",
          reminderMinutes: typeof args.reminderMinutes === "number" ? args.reminderMinutes : 30,
          totalAmount: typeof args.totalAmount === "number" ? args.totalAmount : null,
          paidAmount: typeof args.paidAmount === "number" ? args.paidAmount : null,
          attachments: [],
          done: false,
          createdBy: auth.currentUser?.uid || "",
          createdByName: userName || ""
        };
        const r = await onCreateEvent(newEvent);
        localCacheRef.current.push({ ...newEvent, id: r.id, createdAt: new Date(), updatedAt: new Date() });
        return `OK: evento creado "${args.title}" el ${date}${allDay ? " (todo el día)" : " a las " + (args.startTime || "09:00")}. id=${r.id}`;
      }

      if (name === "update_event") {
        if (!args.id) return "Falta el id del evento.";
        const ev = findEvent(args.id);
        const patch: Partial<CalendarEvent> = {};
        if (args.title != null) patch.title = String(args.title);
        if (args.modality != null) patch.modality = args.modality === "presencial" || args.modality === "virtual" ? args.modality : "otro";
        if (args.color != null) patch.color = String(args.color);
        if (typeof args.reminderMinutes === "number") patch.reminderMinutes = args.reminderMinutes;
        if (typeof args.totalAmount === "number") patch.totalAmount = args.totalAmount;
        if (typeof args.paidAmount === "number") patch.paidAmount = args.paidAmount;
        if (args.date != null || args.startTime != null || args.endTime != null || args.allDay != null) {
          const base = args.date || (ev ? evDate(ev.startAt) : null);
          if (!base) return "No pude determinar la fecha del evento.";
          const allDay = args.allDay != null ? !!args.allDay : ev ? !!ev.allDay : false;
          patch.allDay = allDay;
          patch.startAt = allDay ? buildDate(base, "00:00") : buildDate(base, args.startTime || (ev ? ev24(ev.startAt) : "09:00"));
          patch.endAt = allDay ? buildDate(base, "23:59") : buildDate(base, args.endTime || (ev ? ev24(ev.endAt) : "10:00"));
        }
        await onUpdateEvent(args.id, patch);
        return `OK: evento actualizado (id=${args.id}).`;
      }

      if (name === "duplicate_event") {
        if (!workspaceId) return "No hay agenda seleccionada.";
        const ev = findEvent(args.id);
        if (!ev) return "No encontré el evento a duplicar.";
        const date = args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : evDate(ev.startAt);
        const allDay = !!ev.allDay;
        const start = allDay ? buildDate(date, "00:00") : buildDate(date, args.startTime || ev24(ev.startAt));
        const end = allDay ? buildDate(date, "23:59") : buildDate(date, args.endTime || ev24(ev.endAt));
        const dup: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt"> = {
          workspaceId,
          title: ev.title,
          startAt: start,
          endAt: end,
          allDay,
          color: ev.color,
          modality: ev.modality,
          reminderMinutes: typeof ev.reminderMinutes === "number" ? ev.reminderMinutes : 30,
          totalAmount: typeof ev.totalAmount === "number" ? ev.totalAmount : null,
          paidAmount: typeof ev.paidAmount === "number" ? ev.paidAmount : null,
          attachments: [],
          done: false,
          createdBy: auth.currentUser?.uid || "",
          createdByName: userName || ""
        };
        const r = await onCreateEvent(dup);
        localCacheRef.current.push({ ...dup, id: r.id, createdAt: new Date(), updatedAt: new Date() });
        return `OK: evento duplicado "${ev.title}" al ${date}. id=${r.id}`;
      }

      if (name === "create_coach_session") {
        if (!workspaceId) return "No hay agenda seleccionada.";
        const client = findClient({ code: typeof args.clientCode === "number" ? args.clientCode : undefined, name: args.clientName });
        if (!client) return "No encontré a esa persona en la base de datos. Si es nueva, créala primero con add_client.";
        const date = String(args.date || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "La fecha no es válida (formato YYYY-MM-DD).";
        const allDay = !!args.allDay;
        const start = allDay ? buildDate(date, "00:00") : buildDate(date, args.startTime || "09:00");
        const end = allDay
          ? buildDate(date, "23:59")
          : args.endTime
            ? buildDate(date, args.endTime)
            : new Date(start.getTime() + 60 * 60 * 1000);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Fecha u hora inválida.";
        const ev: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt"> = {
          workspaceId,
          title: client.name,
          startAt: start,
          endAt: end,
          allDay,
          color: args.color || DEFAULT_EVENT_COLOR,
          modality: args.modality === "presencial" || args.modality === "virtual" ? args.modality : "otro",
          kind: "coach",
          clientCode: client.code,
          clientName: client.name,
          reminderMinutes: typeof args.reminderMinutes === "number" ? args.reminderMinutes : 30,
          totalAmount: typeof args.totalAmount === "number" ? args.totalAmount : null,
          paidAmount: typeof args.paidAmount === "number" ? args.paidAmount : null,
          attachments: [],
          done: false,
          createdBy: auth.currentUser?.uid || "",
          createdByName: userName || ""
        };
        const r = await onCreateEvent(ev);
        localCacheRef.current.push({ ...ev, id: r.id, createdAt: new Date(), updatedAt: new Date() });
        return `OK: sesión coach creada para ${client.name} (#${client.code}) el ${date}${allDay ? " (todo el día)" : " a las " + (args.startTime || "09:00")}. id=${r.id}`;
      }

      if (name === "add_client") {
        if (!workspaceId) return "No hay agenda seleccionada.";
        const nm = String(args.name || "").trim();
        if (!nm) return "Falta el nombre de la persona.";
        const existing = findClient({ name: nm });
        if (existing && existing.nameLower === normalizeText(nm)) return `Esa persona ya existe: ${existing.name} (#${existing.code}).`;
        const created = await onCreateClient(nm);
        localClientsRef.current.push(created);
        return `OK: persona creada ${created.name} con código #${created.code}.`;
      }

      if (name === "delete_event") {
        const ok = window.confirm(`¿Eliminar "${args.title || "este evento"}"? No se puede deshacer.`);
        if (!ok) return "El usuario canceló la eliminación.";
        await onDeleteEvent(String(args.id));
        return `OK: evento eliminado (id=${args.id}).`;
      }

      return "Herramienta desconocida.";
    } catch (e: any) {
      return "No se pudo ejecutar la acción: " + (e?.message || "error");
    }
  }

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;

    // La agenda activa aún no terminó de cargar: evita el error y pide reintentar.
    if (!workspaceId) {
      setUiMessages((prev) => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: "Dame un momento: todavía estoy terminando de cargar tu agenda. Vuelve a intentarlo en unos segundos. 🙂" }
      ]);
      setInput("");
      return;
    }

    setUiMessages((prev) => [...prev, { role: "user", content: question }]);
    convoRef.current.push({ role: "user", content: question });
    setInput("");
    setLoading(true);
    setStatus("Pensando...");
    localCacheRef.current = [];
    localClientsRef.current = [];

    try {
      const idToken = await auth.currentUser?.getIdToken();

      let answered = false;
      for (let i = 0; i < 6 && !answered; i++) {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, messages: convoRef.current, workspaceId })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUiMessages((prev) => [...prev, { role: "assistant", content: data.error || "No pude responder en este momento." }]);
          answered = true;
          break;
        }

        const message = data.message || { role: "assistant", content: "No pude generar una respuesta." };
        convoRef.current.push(message);

        const toolCalls = message.tool_calls || [];
        if (toolCalls.length > 0) {
          for (const tc of toolCalls) {
            const name = tc.function?.name || "";
            setStatus(
              name === "create_event"
                ? "Creando evento..."
                : name === "create_coach_session"
                  ? "Agendando sesión coach..."
                  : name === "add_client"
                    ? "Creando persona..."
                    : name === "update_event"
                      ? "Moviendo evento..."
                      : name === "duplicate_event"
                        ? "Duplicando evento..."
                        : name === "delete_event"
                          ? "Eliminando evento..."
                          : "Trabajando..."
            );
            let parsed: any = {};
            try {
              parsed = JSON.parse(tc.function?.arguments || "{}");
            } catch {
              parsed = {};
            }
            const result = await execTool(name, parsed);
            convoRef.current.push({ role: "tool", tool_call_id: tc.id, content: result });
          }
          setStatus("Pensando...");
        } else {
          if (message.content) setUiMessages((prev) => [...prev, { role: "assistant", content: message.content }]);
          answered = true;
        }
      }

      if (!answered) {
        setUiMessages((prev) => [...prev, { role: "assistant", content: "Hice varias acciones; dime si quieres algo más." }]);
      }
    } catch {
      setUiMessages((prev) => [...prev, { role: "assistant", content: "No pude conectar con el asistente. Revisa tu conexión e intenta de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente"
          className="btn-primary fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full p-0 shadow-2xl md:bottom-6 md:right-6"
        >
          <Bot size={24} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-24 left-3 right-3 z-50 flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-3xl border border-app-soft bg-app-panel shadow-2xl backdrop-blur-xl sm:left-auto sm:w-[400px] md:bottom-6 md:right-6">
          <div className="flex items-center justify-between border-b border-app-soft px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-app-soft text-app-accent">
                <Sparkles size={17} />
              </span>
              <div>
                <p className="m-0 text-sm font-black text-app-strong">Asistente</p>
                <p className="m-0 text-[11px] text-app-faint">{workspaceName || "Tu agenda"}</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-app-soft p-1.5 text-app-muted hover:text-app-strong" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="app-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
            {uiMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user" ? "bg-app-accent text-slate-950" : "border border-app-soft bg-app-soft text-app-strong"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-app-soft bg-app-soft px-3 py-2 text-sm text-app-muted">
                  <Spinner className="h-4 w-4" />
                  {status}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-app-soft p-2">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Pídele o pregúntale a tu agenda..."
                className="input-field max-h-28 min-h-11 flex-1 resize-none py-2.5"
              />
              <button type="button" onClick={send} disabled={loading || !input.trim()} className="btn-primary min-h-11 px-3" aria-label="Enviar">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
