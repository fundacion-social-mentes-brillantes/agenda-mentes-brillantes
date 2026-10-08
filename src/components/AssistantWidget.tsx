import { useEffect, useRef, useState } from "react";
import { Bot, Brain, Camera, Send, Sparkles, X, Zap } from "lucide-react";
import { auth } from "../lib/firebase";
import { toDate } from "../lib/dateUtils";
import { DEFAULT_EVENT_COLOR } from "../lib/eventMeta";
import { resolveMeetingLink } from "../lib/meetingLinks";
import { prepararFoto, type FotoChat } from "../lib/foto";
import { Spinner } from "./ui/Spinner";
import { normalizeText } from "../services/clientsService";
import { storageService } from "../services/storageService";
import type { EventWriteResult } from "../services/eventsService";
import type { CalendarEvent } from "../types/event";
import type { Client } from "../types/client";

interface UiMessage {
  role: "assistant" | "user";
  content: string;
  /** Foto que mandó la persona (solo para verla en el chat; no se guarda). */
  foto?: string;
  /** Aclaración pequeña debajo de la respuesta (ej. que contestó el modo Básico). */
  nota?: string;
}

// Los dos modos del asistente. Al servidor solo le mandamos una palabra; él decide
// qué modelo usar de verdad:
// - Básico: DeepSeek, el de siempre ("flash").
// - Experto: Claude Haiku 5.5, piensa más a fondo y lee fotos ("experto").
type ModoAsistente = "basico" | "experto";

/** Un mensaje de la conversacion con el modelo (formato de la API de chat). */
interface MensajeIA {
  role: "user" | "assistant" | "tool" | "system";
  content?: string | null;
  tool_calls?: Array<{ id: string; type?: string; function?: { name?: string; arguments?: string } }>;
  tool_call_id?: string;
  reasoning_content?: string | null;
}

/** Lo que el modelo puede mandar al pedir una accion; todo opcional. */
interface ArgumentosHerramienta {
  id?: string;
  title?: string;
  name?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  color?: string;
  modality?: string;
  reminderMinutes?: number;
  totalAmount?: number;
  paidAmount?: number;
  clientCode?: number;
  clientName?: string;
}

const CAMPOS_TEXTO = ["id", "title", "name", "date", "startTime", "endTime", "color", "modality", "clientName"] as const;
const CAMPOS_NUMERO = ["reminderMinutes", "totalAmount", "paidAmount", "clientCode"] as const;

/**
 * Los argumentos llegan como JSON escrito por el modelo: se queda solo con los
 * campos conocidos y del tipo correcto. Un "startTime": 9 o un "allDay": "si"
 * se descartan en vez de romper la fecha del evento.
 */
function leerArgumentos(crudo: unknown): ArgumentosHerramienta {
  const fuente = crudo && typeof crudo === "object" ? (crudo as Record<string, unknown>) : {};
  const salida: ArgumentosHerramienta = {};
  for (const campo of CAMPOS_TEXTO) {
    const valor = fuente[campo];
    if (typeof valor === "string") salida[campo] = valor;
    else if (typeof valor === "number" && campo === "id") salida.id = String(valor);
  }
  for (const campo of CAMPOS_NUMERO) {
    const valor = fuente[campo];
    if (typeof valor === "number" && Number.isFinite(valor)) salida[campo] = valor;
  }
  if (typeof fuente.allDay === "boolean") salida.allDay = fuente.allDay;
  return salida;
}

// Dónde se recuerda la elección en este navegador.
const CLAVE_MODO = "asistenteModo";

const OPCIONES_MODO: { valor: ModoAsistente; etiqueta: string; descripcion: string; icono: typeof Zap }[] = [
  { valor: "basico", etiqueta: "Básico", descripcion: "Rápido, para el día a día.", icono: Zap },
  { valor: "experto", etiqueta: "Experto", descripcion: "Más a fondo; lee fotos y, si se lo pides, las guarda en un evento.", icono: Brain }
];

/** La foto del chat (JPEG en base64) como archivo, para subirla a los adjuntos de un evento. */
function archivoDeFoto(foto: FotoChat, nombre: string): File {
  const binario = atob(foto.data);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  const base = nombre.trim().slice(0, 60) || "Foto del asistente";
  return new File([bytes], `${base}.jpg`, { type: foto.tipo });
}

// Texto que acompaña una foto mandada sin escribir nada.
const MENSAJE_SOLO_FOTO = "Te mando esta foto. Mira qué hay que agendar y hazlo.";

// Lee la opción guardada. Si el navegador no deja (modo privado), usa "Básico".
function leerModoGuardado(): ModoAsistente {
  try {
    return localStorage.getItem(CLAVE_MODO) === "experto" ? "experto" : "basico";
  } catch {
    return "basico";
  }
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
  onOpen?: () => void;
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
export function AssistantWidget({ events, clients, workspaceName, workspaceId, userName, onCreateEvent, onUpdateEvent, onDeleteEvent, onCreateClient, onOpen }: AssistantWidgetProps) {
  const [open, setOpen] = useState(false);
  const [uiMessages, setUiMessages] = useState<UiMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Pensando...");
  const [modo, setModo] = useState<ModoAsistente>(leerModoGuardado);
  const [foto, setFoto] = useState<FotoChat | null>(null);
  const [fotoAviso, setFotoAviso] = useState("");
  const fotoRef = useRef<HTMLInputElement>(null);
  const convoRef = useRef<MensajeIA[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Caché de eventos creados/duplicados en ESTE turno: permite mover/duplicar/borrar
  // algo recién creado, aunque el listener de Firestore todavía no haya refrescado "events".
  const localCacheRef = useRef<CalendarEvent[]>([]);
  // Caché de personas creadas este turno (para agendar coach justo después de crearlas).
  const localClientsRef = useRef<Client[]>([]);
  // La foto de ESTE pedido (para guardarla en un evento si la persona lo pide) y en qué
  // eventos ya quedó, para no subirla dos veces si el modelo repite la acción.
  const fotoTurnoRef = useRef<FotoChat | null>(null);
  const fotoGuardadaEnRef = useRef<Set<string>>(new Set());

  const findEvent = (id: string | undefined): CalendarEvent | undefined =>
    id ? events.find((e) => e.id === id) || localCacheRef.current.find((e) => e.id === id) : undefined;

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

  // Cambiar de modo NO borra la conversación: solo aplica desde el siguiente mensaje.
  const cambiarModo = (valor: ModoAsistente) => {
    setModo(valor);
    try {
      localStorage.setItem(CLAVE_MODO, valor);
    } catch {
      // Si el navegador no deja guardar (modo privado), igual funciona en esta sesión.
    }
    // El Básico no lee fotos: se quita la que estaba lista para no mandarla en vano.
    if (valor === "basico" && foto) {
      setFoto(null);
      setFotoAviso("Las fotos solo las lee el modo Experto.");
    }
  };

  // Adjuntar una foto pasa al modo Experto, que es el que las lee.
  const abrirFoto = () => {
    setFotoAviso("");
    if (modo !== "experto") cambiarModo("experto");
    fotoRef.current?.click();
  };

  const elegirFoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;
    try {
      setFoto(await prepararFoto(archivo));
      setFotoAviso("");
    } catch (error) {
      setFoto(null);
      setFotoAviso(error instanceof Error ? error.message : "No pude abrir esa foto.");
    }
  };

  async function execTool(name: string, args: ArgumentosHerramienta): Promise<string> {
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
        if (ev && (args.title != null || args.modality != null)) {
          Object.assign(
            patch,
            resolveMeetingLink({
              kind: ev.kind,
              modality: patch.modality || ev.modality,
              title: patch.title || ev.title,
              meetingLinkType: ev.meetingLinkType,
              meetingUrl: ev.meetingUrl
            })
          );
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
          meetingLinkType: ev.meetingLinkType,
          meetingUrl: ev.meetingUrl || "",
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
          // Las sesiones coach son virtuales por defecto (solo presencial si lo piden).
          modality: args.modality === "presencial" ? "presencial" : "virtual",
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

      if (name === "attach_photo") {
        const fotoTurno = fotoTurnoRef.current;
        if (!fotoTurno) return "No hay ninguna foto en este mensaje: pídele a la persona que la mande otra vez junto con el pedido, en modo Experto.";
        if (!storageService.isConfigured()) return "Guardar archivos no está disponible todavía en esta agenda.";
        const id = String(args.id || "");
        const ev = findEvent(id);
        if (!ev) return "No encontré ese evento.";
        if (fotoGuardadaEnRef.current.has(id)) return `OK: la foto ya estaba guardada en "${ev.title}".`;
        const adjunto = await storageService.uploadAttachment(archivoDeFoto(fotoTurno, args.name || ev.title), ev.workspaceId || workspaceId || "", id);
        const adjuntos = [...(ev.attachments || []), adjunto];
        await onUpdateEvent(id, { attachments: adjuntos });
        fotoGuardadaEnRef.current.add(id);
        return `OK: foto guardada en los adjuntos de "${ev.title}".`;
      }

      if (name === "delete_event") {
        const ok = window.confirm(`¿Eliminar "${args.title || "este evento"}"? No se puede deshacer.`);
        if (!ok) return "El usuario canceló la eliminación.";
        await onDeleteEvent(String(args.id));
        return `OK: evento eliminado (id=${args.id}).`;
      }

      return "Herramienta desconocida.";
    } catch (e) {
      return "No se pudo ejecutar la acción: " + (e instanceof Error && e.message ? e.message : "error");
    }
  }

  const send = async () => {
    const escrito = input.trim();
    // La foto solo viaja en modo Experto (cambiarModo ya la quita al pasar a Básico).
    const fotoTurno = modo === "experto" ? foto : null;
    if ((!escrito && !fotoTurno) || loading) return;
    const question = escrito || MENSAJE_SOLO_FOTO;

    // La agenda activa aún no terminó de cargar: evita el error y pide reintentar.
    // La foto se queda lista para el siguiente intento.
    if (!workspaceId) {
      setUiMessages((prev) => [
        ...prev,
        { role: "user", content: escrito || "(foto)" },
        { role: "assistant", content: "Dame un momento: todavía estoy terminando de cargar tu agenda. Vuelve a intentarlo en unos segundos. 🙂" }
      ]);
      setInput("");
      return;
    }

    setUiMessages((prev) => [...prev, { role: "user", content: escrito, ...(fotoTurno ? { foto: fotoTurno.vista } : {}) }]);
    // En la conversación queda la marca de que hubo foto: en los turnos siguientes
    // la foto ya no se manda, pero el asistente sabe que existió.
    convoRef.current.push({ role: "user", content: fotoTurno ? `${question}\n\n[Adjunté una foto]` : question });
    setInput("");
    setFoto(null);
    setFotoAviso("");
    setLoading(true);
    const pensando = modo === "experto" ? "Pensando a fondo..." : "Pensando...";
    setStatus(fotoTurno ? "Mirando la foto..." : pensando);
    localCacheRef.current = [];
    localClientsRef.current = [];
    fotoTurnoRef.current = fotoTurno;
    fotoGuardadaEnRef.current = new Set();

    try {
      const idToken = await auth.currentUser?.getIdToken();

      let answered = false;
      // Si el Experto no pudo y contestó el Básico, se avisa debajo de la respuesta.
      let contestoElBasico = false;
      for (let i = 0; i < 6 && !answered; i++) {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            messages: convoRef.current,
            workspaceId,
            model: modo === "experto" ? "experto" : "flash",
            // La foto va en cada vuelta de ESTE turno: el Experto puede necesitar mirarla
            // otra vez después de crear los primeros eventos.
            ...(fotoTurno ? { foto: { data: fotoTurno.data, tipo: fotoTurno.tipo } } : {})
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUiMessages((prev) => [...prev, { role: "assistant", content: data.error || "No pude responder en este momento." }]);
          answered = true;
          break;
        }

        const message: MensajeIA = data.message || { role: "assistant", content: "No pude generar una respuesta." };
        if (data.respaldo) contestoElBasico = true;
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
                          : name === "attach_photo"
                            ? "Guardando la foto en el evento..."
                            : "Trabajando..."
            );
            let parsed: ArgumentosHerramienta = {};
            try {
              parsed = leerArgumentos(JSON.parse(tc.function?.arguments || "{}"));
            } catch {
              parsed = {};
            }
            const result = await execTool(name, parsed);
            convoRef.current.push({ role: "tool", tool_call_id: tc.id, content: result });
          }
          setStatus(pensando);
        } else {
          // Si por lo que sea llega vacío, decimos algo: nunca dejar al usuario mirando
          // una pantalla muda (se leería como "la app se dañó").
          setUiMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: message.content || "No me salió la respuesta. ¿Me lo repites?",
              ...(contestoElBasico ? { nota: "Contestó el modo Básico: el Experto no respondió esta vez." } : {})
            }
          ]);
          answered = true;
        }
      }

      if (!answered) {
        setUiMessages((prev) => [...prev, { role: "assistant", content: "Hice varias acciones; dime si quieres algo más." }]);
      }
    } catch {
      setUiMessages((prev) => [...prev, { role: "assistant", content: "No pude conectar con el asistente. Revisa tu conexión e intenta de nuevo." }]);
    } finally {
      fotoTurnoRef.current = null;
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            onOpen?.();
            setOpen(true);
          }}
          aria-label="Abrir asistente"
          className="btn-primary fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full p-0 shadow-2xl md:bottom-6 md:right-6"
        >
          <Bot size={24} />
        </button>
      )}

      {open && (
        <div className="panel-flotante fixed bottom-24 left-3 right-3 z-50 flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-3xl sm:left-auto sm:w-[400px] md:bottom-6 md:right-6">
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
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                {m.foto && <img src={m.foto} alt="Foto enviada" className="mb-1 max-h-40 max-w-[70%] rounded-2xl border border-app-soft object-cover" />}
                {m.content && (
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user" ? "accent-gradient" : "border border-app-soft bg-app-soft text-app-strong"
                    }`}
                  >
                    {m.content}
                  </div>
                )}
                {m.nota && <p className="m-0 mt-1 max-w-[85%] px-1 text-[11px] text-app-faint">{m.nota}</p>}
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

          <div className="space-y-2 border-t border-app-soft p-2">
            {/* Básico (DeepSeek) para el día a día; Experto (Claude) piensa más y lee fotos.
                La descripción va VISIBLE: en el celular no existen los tooltips del ratón. */}
            <div className="flex items-center gap-1.5 px-1">
              <p className="m-0 min-w-0 flex-1 truncate text-[11px] text-app-muted">{OPCIONES_MODO.find((o) => o.valor === modo)?.descripcion}</p>
              <div role="group" aria-label="Modo del asistente" className="flex shrink-0 gap-1 rounded-full border border-app-soft bg-app-soft p-0.5">
                {OPCIONES_MODO.map(({ valor, etiqueta, icono: Icono }) => {
                  const activa = modo === valor;
                  return (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => cambiarModo(valor)}
                      aria-pressed={activa}
                      // Mientras responde no se puede cambiar: el turno en curso ya salió con
                      // el modo anterior y encender la otra pastilla sería mentir.
                      disabled={loading}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black transition disabled:opacity-50 ${
                        activa ? "accent-gradient shadow-sm" : "text-app-muted hover:text-app-strong"
                      }`}
                    >
                      <Icono size={12} />
                      {etiqueta}
                    </button>
                  );
                })}
              </div>
            </div>

            {(foto || fotoAviso) && (
              <div className="flex items-center gap-2 rounded-2xl border border-app-soft bg-app-soft p-2 text-xs">
                {foto && <img src={foto.vista} alt="Foto lista para enviar" className="h-12 w-12 shrink-0 rounded-xl object-cover" />}
                <p className={`m-0 min-w-0 flex-1 ${foto ? "text-app-muted" : "font-bold text-app-accent"}`}>
                  {foto ? "Foto lista. Escribe qué hacer con ella, o envíala así." : fotoAviso}
                </p>
                {foto && (
                  <button
                    type="button"
                    onClick={() => setFoto(null)}
                    disabled={loading}
                    aria-label="Quitar la foto"
                    className="shrink-0 rounded-lg p-1 text-app-muted hover:text-app-strong disabled:opacity-50"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}

            <div className="flex items-end gap-2">
              <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => void elegirFoto(e)} />
              <button
                type="button"
                onClick={abrirFoto}
                disabled={loading}
                aria-label="Adjuntar una foto (horario, lista de citas, pantallazo)"
                title="Adjuntar una foto: la lee el modo Experto"
                className="btn-secondary min-h-11 shrink-0 px-3"
              >
                <Camera size={18} />
              </button>
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
                placeholder={foto ? "Ej: agenda todo esto" : "Escribe tu pedido..."}
                className="input-field max-h-28 min-h-11 flex-1 resize-none py-2.5"
              />
              <button
                type="button"
                onClick={send}
                disabled={loading || (!input.trim() && !(modo === "experto" && foto))}
                className="btn-primary min-h-11 px-3"
                aria-label="Enviar"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
