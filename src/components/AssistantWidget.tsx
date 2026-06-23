import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { auth } from "../lib/firebase";
import { toDate } from "../lib/dateUtils";
import { Spinner } from "./ui/Spinner";
import type { CalendarEvent } from "../types/event";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface AssistantWidgetProps {
  events: CalendarEvent[];
  workspaceName?: string;
}

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "¡Hola! Soy tu asistente de la agenda. Pregúntame cosas como: \"¿cuántas sesiones tuvo Laura y en qué fechas?\", \"¿qué tengo esta semana?\" o \"¿cuándo creé el evento de Marcela?\"."
};

function fmtDate(value: CalendarEvent["startAt"]): string {
  const d = toDate(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(event: CalendarEvent): string {
  if (event.allDay) return "todo el día";
  return toDate(event.startAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtCreated(value: CalendarEvent["createdAt"]): string {
  return toDate(value).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

export function AssistantWidget({ events, workspaceName }: AssistantWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, loading]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: question }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const payload = events.slice(0, 800).map((e) => {
        const item: Record<string, unknown> = { t: e.title, f: fmtDate(e.startAt), h: fmtTime(e), m: e.modality, creado: fmtCreated(e.createdAt) };
        if (typeof e.totalAmount === "number") item.vt = e.totalAmount;
        if (typeof e.paidAmount === "number") item.va = e.paidAmount;
        return item;
      });
      const today = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          question,
          events: payload,
          history: messages.filter((m) => m !== GREETING).slice(-6),
          today,
          workspaceName: workspaceName || ""
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages([...nextMessages, { role: "assistant", content: data.error || "No pude responder en este momento." }]);
      } else {
        setMessages([...nextMessages, { role: "assistant", content: data.answer || "No pude generar una respuesta." }]);
      }
    } catch {
      setMessages([...nextMessages, { role: "assistant", content: "No pude conectar con el asistente. Revisa tu conexión e intenta de nuevo." }]);
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
        <div className="fixed bottom-24 right-3 left-3 z-50 flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-3xl border border-app-soft bg-app-panel shadow-2xl backdrop-blur-xl sm:left-auto sm:w-[400px] md:bottom-6 md:right-6">
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
            {messages.map((m, i) => (
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
                  Pensando...
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
                placeholder="Pregúntale a tu agenda..."
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
