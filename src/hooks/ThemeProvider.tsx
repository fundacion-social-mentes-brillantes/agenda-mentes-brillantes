import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { Apariencia } from "../types/theme";
import { ThemeContext, type ThemeContextType } from "./themeContext";
import { APARIENCIA_PREDETERMINADA, leerApariencia, paleta, resolverModo } from "../lib/tema";

// Lo que se recuerda en este navegador. index.html lee "aparienciaVars" antes de
// pintar, para que la pantalla no parpadee con otro color mientras carga.
const CLAVE_APARIENCIA = "apariencia";
const CLAVE_VARIABLES = "aparienciaVars";

function leerGuardada(): Apariencia {
  try {
    const nueva = localStorage.getItem(CLAVE_APARIENCIA);
    // Formato anterior (temas "dark" / "pink" / "custom"): se convierte una vez.
    const viejo = localStorage.getItem("theme");
    const personalViejo = localStorage.getItem("temaPersonal");
    return (
      leerApariencia(nueva ? JSON.parse(nueva) : null, viejo, personalViejo ? JSON.parse(personalViejo) : null) ??
      APARIENCIA_PREDETERMINADA
    );
  } catch {
    return APARIENCIA_PREDETERMINADA;
  }
}

function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (modo privado): vale solo en esta visita.
  }
}

// ¿El celular o el computador está en modo oscuro? (para el modo automático)
const consultaOscuro = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);
function suscribirse(avisar: () => void) {
  const consulta = consultaOscuro();
  consulta?.addEventListener("change", avisar);
  return () => consulta?.removeEventListener("change", avisar);
}
const sistemaEsOscuro = () => Boolean(consultaOscuro()?.matches);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [apariencia, setApariencia] = useState<Apariencia>(leerGuardada);
  const sistemaOscuro = useSyncExternalStore(suscribirse, sistemaEsOscuro, () => true);
  const base = resolverModo(apariencia.modo, sistemaOscuro);

  useEffect(() => {
    const root = document.documentElement;
    const extra = { fondo: apariencia.fondo, destello: apariencia.destello };
    const variables = paleta(apariencia.acento, base, extra);
    root.dataset.base = base;
    root.dataset.modo = apariencia.modo;
    root.classList.toggle("dark", base === "dark");
    for (const [nombre, valor] of Object.entries(variables)) root.style.setProperty(nombre, valor);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", variables["--app-bg"]);

    guardar(CLAVE_APARIENCIA, JSON.stringify(apariencia));
    // Las dos versiones (clara y oscura): el modo automático puede cambiar antes de que cargue React.
    guardar(
      CLAVE_VARIABLES,
      JSON.stringify({ dark: paleta(apariencia.acento, "dark", extra), light: paleta(apariencia.acento, "light", extra) })
    );
  }, [apariencia, base]);

  const value = useMemo<ThemeContextType>(
    () => ({
      apariencia,
      setApariencia,
      base,
      isLight: base === "light",
      toggleTheme: () => setApariencia((actual) => ({ ...actual, modo: base === "dark" ? "claro" : "oscuro" })),
      themeLabel: base === "dark" ? "Oscuro" : "Claro"
    }),
    [apariencia, base]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
