import { useRef, useState } from "react";
import type React from "react";
import { Check, MonitorSmartphone, Moon, RotateCcw, Save, Sparkles, Sun } from "lucide-react";
import { Card } from "./ui/Card";
import { useGuardarApariencia, useTheme } from "../hooks/useTheme";
import {
  APARIENCIA_PREDETERMINADA,
  COLORES_SUGERIDOS,
  DESTELLOS_SUGERIDOS,
  FONDOS_SUGERIDOS,
  hexAHsv,
  hsvAHex,
  mismaApariencia,
  normalizarHex,
  paleta,
  resolverModo,
  type Hsv
} from "../lib/tema";
import type { Apariencia, ModoTema } from "../types/theme";

const MODOS: { value: ModoTema; label: string; icon: typeof Sun }[] = [
  { value: "claro", label: "Claro", icon: Sun },
  { value: "oscuro", label: "Oscuro", icon: Moon },
  { value: "auto", label: "Automático", icon: MonitorSmartphone }
];

/** Qué color se está cambiando con la rueda. */
type Objetivo = "acento" | "fondo" | "destello";

const OBJETIVOS: { value: Objetivo; label: string; ayuda: string }[] = [
  { value: "acento", label: "Principal", ayuda: "Botones, día elegido y detalles." },
  { value: "fondo", label: "Fondo", ayuda: "El fondo de toda la agenda (en modo claro, un tinte suave)." },
  { value: "destello", label: "Destellos", ayuda: "La luz alrededor del día elegido, del «+» y de los botones." }
];

// Lo que se ve cuando el fondo está en "Automático".
const FONDO_LOGO = "#0b0820";

/**
 * Apariencia: modo (claro, oscuro, automático) y tres colores (principal, fondo y
 * destellos) con rueda, saturación, brillo y código HEX. Lo que se mueve aquí se ve
 * en la vista previa; la app cambia al darle "Guardar" (y queda en el perfil).
 * Vive en Ajustes y también se abre directo desde el menú, en una ventana.
 */
export function EditorApariencia({ enVentana = false, onListo }: { enVentana?: boolean; onListo?: () => void }) {
  const { apariencia } = useTheme();
  const guardarApariencia = useGuardarApariencia();
  // null = sin cambios: se muestra lo que está aplicado.
  const [borrador, setBorrador] = useState<Apariencia | null>(null);
  const editada = borrador ?? apariencia;
  const [objetivo, setObjetivo] = useState<Objetivo>("acento");
  const [hsv, setHsv] = useState<Hsv>(() => hexAHsv(apariencia.acento));
  const [textoHex, setTextoHex] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [avisoGuardado, setAvisoGuardado] = useState(false);

  const hayCambios = borrador !== null && !mismaApariencia(borrador, apariencia);
  const sistemaOscuro = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const baseVista = resolverModo(editada.modo, Boolean(sistemaOscuro));

  const acento = normalizarHex(editada.acento) ?? APARIENCIA_PREDETERMINADA.acento;
  const fondo = normalizarHex(editada.fondo);
  const destello = normalizarHex(editada.destello);
  // El color que muestra la rueda: el elegido, o el automático si no hay uno propio.
  const colorDe = (cual: Objetivo) => (cual === "acento" ? acento : cual === "fondo" ? fondo ?? FONDO_LOGO : destello ?? acento);
  const colorActual = colorDe(objetivo);
  const esAutomatico = (objetivo === "fondo" && !fondo) || (objetivo === "destello" && !destello);
  const sugeridos = objetivo === "acento" ? COLORES_SUGERIDOS : objetivo === "fondo" ? FONDOS_SUGERIDOS : DESTELLOS_SUGERIDOS;

  const cambiar = (cambio: Partial<Apariencia>) => {
    setAvisoGuardado(false);
    setBorrador({ ...editada, ...cambio });
  };

  const elegirObjetivo = (cual: Objetivo) => {
    setObjetivo(cual);
    setHsv(hexAHsv(colorDe(cual)));
    setTextoHex(null);
  };

  // Rueda y barras: mandan el tono, la saturación y el brillo del color que se está cambiando.
  const cambiarHsv = (siguiente: Hsv) => {
    setHsv(siguiente);
    setTextoHex(null);
    cambiar({ [objetivo]: hsvAHex(siguiente) });
  };

  // Colores sugeridos y código HEX: mandan el color exacto.
  const elegirColor = (hex: string) => {
    setHsv(hexAHsv(hex));
    cambiar({ [objetivo]: hex });
  };

  const usarAutomatico = () => {
    cambiar({ [objetivo]: null });
    setHsv(hexAHsv(objetivo === "fondo" ? FONDO_LOGO : acento));
    setTextoHex(null);
  };

  const restablecer = () => {
    setObjetivo("acento");
    setHsv(hexAHsv(APARIENCIA_PREDETERMINADA.acento));
    setTextoHex(null);
    cambiar({ ...APARIENCIA_PREDETERMINADA, fondo: null, destello: null });
  };

  const guardar = async () => {
    if (!borrador) return;
    setGuardando(true);
    await guardarApariencia(borrador);
    setGuardando(false);
    setBorrador(null);
    setAvisoGuardado(true);
    onListo?.();
  };

  const contenido = (
    <div className="space-y-5">
      {!enVentana && (
        <div>
          <h3 className="m-0 text-lg font-semibold tracking-tight text-app-strong">Apariencia</h3>
          <p className="mt-1 text-sm text-app-muted">Elige el modo y tus colores. Se guarda en tu perfil, para el celular y el computador.</p>
        </div>
      )}

      <div>
        <p className="section-label mb-2">Modo</p>
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-app-soft bg-app-soft p-1" role="group" aria-label="Modo de la pantalla">
          {MODOS.map(({ value, label, icon: Icon }) => {
            const activo = editada.modo === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => cambiar({ modo: value })}
                aria-pressed={activo}
                className={`flex min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition sm:gap-1.5 sm:px-2 sm:text-xs ${
                  activo ? "bg-app-panel text-app-strong shadow-sm" : "text-app-muted hover:text-app-strong"
                }`}
              >
                <span className={activo ? "icono-degradado" : ""}>
                  <Icon size={15} />
                </span>
                {value === "auto" ? (
                  <>
                    <span className="sm:hidden">Auto</span>
                    <span className="hidden sm:inline">{label}</span>
                  </>
                ) : (
                  label
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="section-label mb-2">¿Qué color cambias?</p>
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-app-soft bg-app-soft p-1" role="tablist" aria-label="Color que se cambia">
          {OBJETIVOS.map(({ value, label }) => {
            const activo = objetivo === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => elegirObjetivo(value)}
                className={`flex min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition sm:gap-1.5 sm:px-2 sm:text-xs ${
                  activo ? "bg-app-panel text-app-strong shadow-sm" : "text-app-muted hover:text-app-strong"
                }`}
              >
                <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-white/30" style={{ background: colorDe(value) }} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
        <p className="m-0 mt-1.5 px-1 text-xs text-app-faint">{OBJETIVOS.find((o) => o.value === objetivo)?.ayuda}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
        <div className="flex flex-col items-center gap-3">
          <RuedaColor tono={hsv.h} color={colorActual} onTono={(h) => cambiarHsv({ ...hsv, h })} />
          {objetivo !== "acento" && (
            <button
              type="button"
              onClick={usarAutomatico}
              aria-pressed={esAutomatico}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                esAutomatico ? "accent-gradient border-transparent" : "border-app-soft text-app-muted hover:text-app-strong"
              }`}
            >
              <Sparkles size={13} />
              {esAutomatico ? "Automático (según el principal)" : "Volver a automático"}
            </button>
          )}
        </div>

        <div className="space-y-4">
          <BarraColor
            etiqueta="Saturación"
            valor={hsv.s}
            fondo={`linear-gradient(90deg, ${hsvAHex({ ...hsv, s: 0 })}, ${hsvAHex({ ...hsv, s: 100 })})`}
            onCambio={(s) => cambiarHsv({ ...hsv, s })}
          />
          <BarraColor
            etiqueta="Brillo"
            valor={hsv.v}
            minimo={objetivo === "fondo" ? 0 : 15}
            fondo={`linear-gradient(90deg, ${hsvAHex({ ...hsv, v: objetivo === "fondo" ? 0 : 15 })}, ${hsvAHex({ ...hsv, v: 100 })})`}
            onCambio={(v) => cambiarHsv({ ...hsv, v })}
          />

          <label className="block">
            <span className="section-label mb-1.5 block">Código HEX</span>
            <span className="flex items-center gap-2">
              <span className="h-10 w-10 shrink-0 rounded-xl border border-app-soft" style={{ background: colorActual }} aria-hidden="true" />
              <input
                className="input-field py-2 font-mono text-sm uppercase"
                value={textoHex ?? colorActual}
                maxLength={7}
                spellCheck={false}
                onChange={(e) => {
                  setTextoHex(e.target.value);
                  const hex = normalizarHex(e.target.value);
                  if (hex && e.target.value.replace("#", "").length === 6) elegirColor(hex);
                }}
                onBlur={() => setTextoHex(null)}
                aria-label="Código HEX del color"
              />
            </span>
          </label>

          <div>
            <p className="section-label mb-2">Sugeridos</p>
            <div className="flex flex-wrap gap-2">
              {sugeridos.map((color) => {
                const elegido = !esAutomatico && colorActual === color.value;
                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => {
                      setTextoHex(null);
                      elegirColor(color.value);
                    }}
                    aria-label={color.label}
                    aria-pressed={elegido}
                    title={color.label}
                    className={`flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-transparent transition hover:scale-110 ${
                      elegido ? "ring-2 ring-[color:var(--app-accent)]" : "ring-1 ring-white/25"
                    }`}
                    style={{ background: color.value }}
                  >
                    {elegido && <Check size={14} className="text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="section-label mb-2">Vista previa {editada.modo === "auto" ? `(ahora se ve ${baseVista === "dark" ? "oscura" : "clara"})` : ""}</p>
        <VistaPrevia acento={acento} base={baseVista} fondo={fondo} destello={destello} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-app-soft pt-4">
        <p className="m-0 mr-auto text-xs text-app-faint" role="status">
          {hayCambios ? "Tienes cambios sin guardar." : avisoGuardado ? "Guardado." : ""}
        </p>
        <button type="button" onClick={restablecer} className="btn-secondary min-h-10 py-2 text-xs">
          <RotateCcw size={15} />
          Restablecer
        </button>
        <button type="button" onClick={() => void guardar()} disabled={!hayCambios || guardando} className="btn-primary min-h-10 py-2 text-xs disabled:opacity-50">
          <Save size={15} />
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );

  return enVentana ? contenido : <Card className="glass">{contenido}</Card>;
}

const TAMANO_RUEDA = 184;
const GROSOR_RUEDA = 22;

/** Rueda de tonos: se arrastra el punto (o se usan las flechas del teclado). */
function RuedaColor({ tono, color, onTono }: { tono: number; color: string; onTono: (tono: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const arrastrando = useRef(false);

  const tonoDesde = (e: React.PointerEvent) => {
    const caja = ref.current?.getBoundingClientRect();
    if (!caja) return;
    const x = e.clientX - (caja.left + caja.width / 2);
    const y = e.clientY - (caja.top + caja.height / 2);
    // 0° arriba y girando como el reloj, igual que el degradado de la rueda.
    let angulo = (Math.atan2(x, -y) * 180) / Math.PI;
    if (angulo < 0) angulo += 360;
    onTono(Math.round(angulo));
  };

  const radio = TAMANO_RUEDA / 2 - GROSOR_RUEDA / 2;
  const rad = (tono * Math.PI) / 180;
  const puntoX = TAMANO_RUEDA / 2 + radio * Math.sin(rad);
  const puntoY = TAMANO_RUEDA / 2 - radio * Math.cos(rad);

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Tono del color principal"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={tono}
      className="relative shrink-0 cursor-pointer select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
      style={{ width: TAMANO_RUEDA, height: TAMANO_RUEDA, touchAction: "none" }}
      onPointerDown={(e) => {
        arrastrando.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        tonoDesde(e);
      }}
      onPointerMove={(e) => {
        if (arrastrando.current) tonoDesde(e);
      }}
      onPointerUp={() => {
        arrastrando.current = false;
      }}
      onPointerCancel={() => {
        arrastrando.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onTono((tono + 5) % 360);
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          onTono((tono + 355) % 360);
        }
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(hsl(0 90% 60%), hsl(60 90% 60%), hsl(120 80% 50%), hsl(180 85% 55%), hsl(240 90% 62%), hsl(300 85% 60%), hsl(360 90% 60%))",
          WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${GROSOR_RUEDA}px), #000 calc(100% - ${GROSOR_RUEDA - 1}px))`,
          mask: `radial-gradient(farthest-side, transparent calc(100% - ${GROSOR_RUEDA}px), #000 calc(100% - ${GROSOR_RUEDA - 1}px))`
        }}
      />
      {/* Centro: el color elegido, con su brillo. */}
      <div
        className="absolute rounded-full border border-white/20"
        style={{
          inset: GROSOR_RUEDA + 14,
          background: color,
          boxShadow: `0 0 30px ${color}, inset 0 1px 0 rgba(255,255,255,0.4)`
        }}
      />
      <span
        className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-lg"
        style={{ left: puntoX, top: puntoY, background: hsvAHex({ h: tono, s: 85, v: 100 }) }}
      />
    </div>
  );
}

function BarraColor({
  etiqueta,
  valor,
  minimo = 0,
  fondo,
  onCambio
}: {
  etiqueta: string;
  valor: number;
  minimo?: number;
  fondo: string;
  onCambio: (valor: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="section-label">{etiqueta}</span>
        <span className="text-xs tabular-nums text-app-faint">{valor}%</span>
      </span>
      <input
        type="range"
        min={minimo}
        max={100}
        value={valor}
        onChange={(e) => onCambio(Number(e.target.value))}
        className="barra-color w-full"
        style={{ background: fondo }}
      />
    </label>
  );
}

const DIAS_VISTA = [6, 7, 8, 9, 10, 11, 12];

/** Muestra en pequeño cómo se verá la agenda con el color y el modo elegidos. */
function VistaPrevia({
  acento,
  base,
  fondo,
  destello
}: {
  acento: string;
  base: "light" | "dark";
  fondo: string | null;
  destello: string | null;
}) {
  const variables = paleta(acento, base, { fondo, destello }) as React.CSSProperties;
  return (
    <div
      data-base={base}
      className="overflow-hidden rounded-3xl border border-app-soft p-4"
      style={{
        ...variables,
        background:
          "radial-gradient(60% 60% at 0% 0%, var(--app-glow), transparent 72%), radial-gradient(60% 60% at 100% 100%, var(--app-glow-2), transparent 72%), linear-gradient(160deg, var(--app-bg), var(--app-bg-soft))",
        color: "var(--app-strong)"
      }}
    >
      <div className="glass-panel rounded-2xl p-3">
        <p className="m-0 text-sm font-semibold tracking-tight text-app-strong">
          Octubre <span className="font-normal text-app-faint">2026</span>
        </p>
        <div className="mt-2 grid grid-cols-7 text-center">
          {DIAS_VISTA.map((dia) => (
            <span key={dia} className="flex flex-col items-center gap-1">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  dia === 9 ? "cal-dia--elegido" : dia === 8 ? "cal-dia--hoy" : "text-app-strong"
                }`}
              >
                {dia}
              </span>
              <span className="h-1 w-2.5 rounded-full" style={{ background: dia % 2 ? "var(--app-accent)" : "var(--app-accent-2)", opacity: dia === 12 ? 0 : 1 }} />
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        {[
          { hora: "9:00 a. m.", titulo: "Sesión coach", color: "var(--app-accent)" },
          { hora: "3:30 p. m.", titulo: "Reunión de equipo", color: "var(--app-accent-2)" }
        ].map((fila) => (
          <div key={fila.titulo} className="flex items-center gap-2.5 rounded-2xl border border-app-soft bg-app-panel px-2 py-2">
            <span className="h-8 w-1 rounded-full" style={{ background: fila.color }} />
            <span className="w-16 text-[11px] font-semibold text-app-strong">{fila.hora}</span>
            <span className="truncate text-sm font-medium text-app-strong">{fila.titulo}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-app-muted">Así se verá tu agenda</span>
        <span className="btn-primary pointer-events-none min-h-9 rounded-full px-4 py-1.5 text-xs">Nuevo evento</span>
      </div>
    </div>
  );
}
