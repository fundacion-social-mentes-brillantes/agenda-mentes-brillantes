import { useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, HeartHandshake, Plus, Search, Upload, UserPlus, UserRound } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { formatEventTime, toDate } from "../lib/dateUtils";
import { normalizeText } from "../services/clientsService";
import { parseClientsCsv } from "../lib/clientsCsv";
import type { Client } from "../types/client";
import type { CalendarEvent } from "../types/event";

interface CoachPageProps {
  clients: Client[];
  events: CalendarEvent[];
  loadingClients: boolean;
  onImportClients: (rows: { code: number; name: string; active?: boolean }[]) => Promise<number>;
  onCreateClient: (name: string) => Promise<Client>;
  onNewCoachSession: (client?: { code: number; name: string }) => void;
  onEditEvent: (event: CalendarEvent) => void;
}

export default function CoachPage({
  clients,
  events,
  loadingClients,
  onImportClients,
  onCreateClient,
  onNewCoachSession,
  onEditEvent
}: CoachPageProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const now = new Date();

  // Sesiones coach agrupadas por código de persona.
  const byCode = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const e of events) {
      if (e.kind !== "coach" || typeof e.clientCode !== "number") continue;
      const arr = map.get(e.clientCode) || [];
      arr.push(e);
      map.set(e.clientCode, arr);
    }
    return map;
  }, [events]);

  const totalSessions = useMemo(() => events.filter((e) => e.kind === "coach").length, [events]);

  const filtered = useMemo(() => {
    const terms = normalizeText(search).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return clients;
    // Cada palabra debe aparecer en el nombre (o coincidir con el código): "adriana acevedo" encuentra "Adriana Paola Acevedo".
    return clients.filter((c) => terms.every((t) => c.nameLower.includes(t) || String(c.code) === t));
  }, [clients, search]);

  const countsFor = (code: number) => {
    const list = byCode.get(code) || [];
    const tomadas = list.filter((e) => toDate(e.startAt).getTime() < now.getTime()).length;
    // "Compradas" = el paquete más grande registrado (no la suma), para que no se descuadre
    // al registrar el paquete (ej. 24) y además crear cada sesión.
    const compradas = list.reduce((m, e) => Math.max(m, typeof e.purchasedSessions === "number" && e.purchasedSessions >= 0 ? e.purchasedSessions : 1), 0);
    return { total: list.length, tomadas, proximas: list.length - tomadas, compradas };
  };

  const sessionsFor = (code: number) =>
    [...(byCode.get(code) || [])].sort((a, b) => toDate(b.startAt).getTime() - toDate(a.startAt).getTime());

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      const text = await file.text();
      const rows = parseClientsCsv(text);
      if (rows.length === 0) throw new Error("No se encontraron filas válidas en el CSV.");
      const n = await onImportClients(rows);
      setNotice(`Se importaron ${n} personas correctamente.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar el CSV.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleAddPerson = async () => {
    const name = window.prompt("Nombre de la persona nueva (se le asigna el siguiente código):");
    if (!name || !name.trim()) return;
    setError(null);
    setNotice(null);
    try {
      const c = await onCreateClient(name.trim());
      setNotice(`Persona creada: ${c.name} · #${c.code}`);
      setSearch(c.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la persona.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="section-label mb-2">Coaching</p>
          <h2 className="m-0 flex items-center gap-2 text-3xl font-black tracking-tight text-app-strong">
            <HeartHandshake size={26} className="text-app-accent" />
            Sesiones coach
          </h2>
          <p className="mt-2 text-sm text-app-muted">
            {clients.length} personas · {totalSessions} sesiones registradas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNewCoachSession()} className="btn-primary">
            <Plus size={17} />
            Nueva sesión
          </button>
          <button type="button" onClick={handleAddPerson} className="btn-secondary">
            <UserPlus size={16} />
            Agregar persona
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary">
            {importing ? <Spinner className="h-4 w-4" /> : <Upload size={16} />}
            Importar CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-600">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      {error && <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm font-bold text-red-500">{error}</div>}

      <Card className="space-y-4">
        <label className="relative block">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-app-faint">
            <Search size={17} />
          </span>
          <input className="input-field pl-11" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar persona por nombre o código..." />
        </label>
      </Card>

      {loadingClients ? (
        <Card className="flex min-h-48 items-center justify-center">
          <Spinner className="h-7 w-7 text-app-accent" />
        </Card>
      ) : clients.length === 0 ? (
        <Card className="flex min-h-72 flex-col items-center justify-center border-dashed text-center">
          <UserRound size={48} className="mb-3 text-app-accent" />
          <h3 className="m-0 text-xl font-black text-app-strong">Aún no hay personas</h3>
          <p className="mt-2 max-w-md text-sm text-app-muted">
            Importa tu lista de asistentes desde el CSV (botón "Importar CSV") o agrega personas una por una.
          </p>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={importing} className="btn-primary mt-5">
            {importing ? <Spinner className="h-4 w-4" /> : <Upload size={16} />}
            Importar CSV
          </button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="flex min-h-48 flex-col items-center justify-center border-dashed text-center">
          <p className="m-0 text-sm font-bold text-app-muted">Ninguna persona coincide con "{search}".</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => {
            const counts = countsFor(c.code);
            const isOpen = expanded === c.code;
            return (
              <Card key={c.id} className="p-0">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : c.code)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-app-soft text-sm font-black text-app-accent">
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-base font-black text-app-strong">{c.name}</p>
                    <p className="m-0 text-xs font-bold text-app-faint">#{c.code}</p>
                  </div>
                  <div className="hidden gap-2 sm:flex">
                    <Badge label="Tomadas" value={counts.tomadas} tone="done" />
                    <Badge label="Próximas" value={counts.proximas} tone="next" />
                    <Badge label="Compradas" value={counts.compradas} tone="total" />
                  </div>
                  <ChevronDown size={18} className={`shrink-0 text-app-faint transition ${isOpen ? "rotate-180" : ""}`} />
                </button>

                <div className="flex gap-2 px-4 pb-3 sm:hidden">
                  <Badge label="Tomadas" value={counts.tomadas} tone="done" />
                  <Badge label="Próximas" value={counts.proximas} tone="next" />
                  <Badge label="Compradas" value={counts.compradas} tone="total" />
                </div>

                {isOpen && (
                  <div className="space-y-2 border-t border-app-soft p-4">
                    <div className="flex items-center justify-between">
                      <p className="m-0 section-label">Sesiones</p>
                      <button type="button" onClick={() => onNewCoachSession({ code: c.code, name: c.name })} className="btn-secondary min-h-9 px-3 py-1.5 text-xs">
                        <Plus size={14} />
                        Agendar
                      </button>
                    </div>
                    {sessionsFor(c.code).length === 0 ? (
                      <p className="m-0 text-sm text-app-muted">Todavía no tiene sesiones. Toca "Agendar" para crear la primera.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {sessionsFor(c.code).map((ev) => {
                          const past = toDate(ev.startAt).getTime() < now.getTime();
                          return (
                            <li key={ev.id}>
                              <button
                                type="button"
                                onClick={() => onEditEvent(ev)}
                                className="flex w-full items-center gap-3 rounded-2xl border border-app-soft bg-app-panel p-3 text-left transition hover:bg-app-soft"
                              >
                                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${past ? "bg-app-faint" : "bg-app-accent"}`} />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-bold text-app-strong">
                                    {toDate(ev.startAt).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                  <span className="block text-xs text-app-faint">{formatEventTime(ev)} · {past ? "Tomada" : "Próxima"}</span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Badge({ label, value, tone }: { label: string; value: number; tone: "done" | "next" | "total" }) {
  const toneClass =
    tone === "done"
      ? "border-app-soft bg-app-soft text-app-muted"
      : tone === "next"
        ? "border-app-accent/30 bg-app-soft text-app-accent"
        : "border-app-soft bg-app-panel text-app-strong";
  return (
    <span className={`flex flex-col items-center rounded-2xl border px-3 py-1 ${toneClass}`}>
      <span className="text-base font-black leading-none">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
