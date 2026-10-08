import { useEffect, useRef } from "react";
import { Check, Moon, Sun } from "lucide-react";
import { Card } from "./ui/Card";
import { useGuardarTema, useTheme } from "../hooks/useTheme";
import { COLORES_SUGERIDOS, normalizarHex, paletaPersonal } from "../lib/tema";
import type { AppTheme, CustomTheme, ThemeBase } from "../types/theme";

// Cuánto se espera después del último cambio de color antes de guardarlo en el
// perfil: arrastrar el selector manda decenas de cambios por segundo.
const ESPERA_GUARDADO_MS = 700;

/** Tarjeta de Ajustes para elegir el tema y, en "Mi color", armarlo. */
export function TemaVisual() {
  const { theme, customTheme, setTheme, setCustomTheme } = useTheme();
  const guardarTema = useGuardarTema();
  const pendiente = useRef<CustomTheme | null>(null);
  const reloj = useRef<number | null>(null);
  const guardarRef = useRef(guardarTema);

  useEffect(() => {
    guardarRef.current = guardarTema;
  }, [guardarTema]);

  // Si la persona sale de Ajustes antes de que se guarde el último color, se guarda ya.
  useEffect(
    () => () => {
      if (reloj.current) window.clearTimeout(reloj.current);
      if (pendiente.current) void guardarRef.current("custom", pendiente.current);
    },
    []
  );

  const elegirTema = (tema: AppTheme) => {
    void guardarTema(tema);
  };

  // Cambia el color al instante en pantalla y lo guarda en el perfil un momento después.
  const cambiarPersonal = (cambio: Partial<CustomTheme>) => {
    const siguiente: CustomTheme = { ...customTheme, ...cambio };
    setTheme("custom");
    setCustomTheme(siguiente);
    pendiente.current = siguiente;
    if (reloj.current) window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => {
      reloj.current = null;
      const valor = pendiente.current;
      pendiente.current = null;
      if (valor) void guardarRef.current("custom", valor);
    }, ESPERA_GUARDADO_MS);
  };

  const acento = normalizarHex(customTheme.accent) ?? "#8b7cf6";
  const vistaPersonal = paletaPersonal(customTheme);

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="m-0 text-lg font-black text-app-strong">Tema visual</h3>
        <p className="mt-1 text-sm text-app-muted">Así ves tu agenda. Se guarda en tu perfil, para el celular y el computador.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <OpcionTema
          activa={theme === "dark"}
          titulo="Noche Dorada"
          descripcion="El azul y el dorado del logo."
          fondo="linear-gradient(160deg, #0a1026 0%, #18234f 100%)"
          acento="#d7b46a"
          onClick={() => elegirTema("dark")}
        />
        <OpcionTema
          activa={theme === "pink"}
          titulo="Rosa pastel"
          descripcion="Blanco con rosado suave."
          fondo="linear-gradient(160deg, #ffffff 0%, #fde9f0 100%)"
          acento="#f49ab9"
          onClick={() => elegirTema("pink")}
        />
        <OpcionTema
          activa={theme === "custom"}
          titulo="Mi color"
          descripcion="Elige tu color y si lo quieres claro u oscuro."
          fondo={`linear-gradient(160deg, ${vistaPersonal["--app-bg"]} 0%, ${vistaPersonal["--app-bg-soft"]} 100%)`}
          acento={acento}
          onClick={() => elegirTema("custom")}
        />
      </div>

      {theme === "custom" && (
        <div className="space-y-4 rounded-3xl border border-app-soft bg-app-soft p-4">
          <div>
            <p className="section-label mb-2">Fondo</p>
            <div className="inline-flex gap-1 rounded-2xl border border-app-soft bg-app-panel p-1" role="group" aria-label="Fondo del tema">
              {(
                [
                  { value: "light", label: "Claro", icon: Sun },
                  { value: "dark", label: "Oscuro", icon: Moon }
                ] as { value: ThemeBase; label: string; icon: typeof Sun }[]
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => cambiarPersonal({ base: value })}
                  aria-pressed={customTheme.base === value}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    customTheme.base === value ? "accent-gradient shadow-sm" : "text-app-muted hover:text-app-strong"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="section-label mb-2">Color</p>
            <div className="flex flex-wrap items-center gap-2">
              {COLORES_SUGERIDOS.map((color) => {
                const elegido = acento === color.value;
                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => cambiarPersonal({ accent: color.value })}
                    aria-label={color.label}
                    aria-pressed={elegido}
                    title={color.label}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition hover:scale-105 ${
                      elegido ? "border-app-accent" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                  >
                    {elegido && <Check size={16} className="text-white drop-shadow" />}
                  </button>
                );
              })}
              <label
                className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-app-soft bg-app-panel px-3 text-xs font-black text-app-muted"
                title="Cualquier otro color"
              >
                <input
                  type="color"
                  value={acento}
                  onChange={(e) => cambiarPersonal({ accent: e.target.value })}
                  className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  aria-label="Elegir otro color"
                />
                Otro color
              </label>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function OpcionTema({
  activa,
  titulo,
  descripcion,
  fondo,
  acento,
  onClick
}: {
  activa: boolean;
  titulo: string;
  descripcion: string;
  fondo: string;
  acento: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`overflow-hidden rounded-3xl border text-left transition ${
        activa ? "border-app-accent ring-2 ring-[color:var(--app-accent)]" : "border-app-soft hover:-translate-y-0.5"
      }`}
    >
      {/* Muestra en miniatura: fondo, un "evento" y el botón del color. */}
      <div className="flex h-16 items-end gap-1.5 p-2.5" style={{ background: fondo }}>
        <span className="h-6 flex-1 rounded-lg" style={{ background: `color-mix(in srgb, ${acento} 22%, transparent)`, borderLeft: `3px solid ${acento}` }} />
        <span className="h-6 w-6 rounded-full" style={{ background: acento }} />
      </div>
      <div className="bg-app-panel p-3">
        <p className="m-0 flex items-center gap-1.5 text-sm font-black text-app-strong">
          {titulo}
          {activa && <Check size={14} className="text-app-accent" />}
        </p>
        <p className="m-0 mt-0.5 text-xs leading-snug text-app-muted">{descripcion}</p>
      </div>
    </button>
  );
}
