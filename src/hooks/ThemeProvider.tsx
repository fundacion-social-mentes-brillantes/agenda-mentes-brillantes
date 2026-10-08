import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AppTheme, CustomTheme } from "../types/theme";
import { NOMBRES_TEMA, ThemeContext, type ThemeContextType } from "./themeContext";
import { TEMA_PERSONAL_INICIAL, baseDelTema, colorDeBarra, leerTema, leerTemaPersonal, paletaPersonal } from "../lib/tema";

// Lo que se recuerda en este navegador. index.html lee las mismas claves antes
// de pintar, para que la pantalla no parpadee con el tema equivocado.
const CLAVE_TEMA = "theme";
const CLAVE_TEMA_PERSONAL = "temaPersonal";

function leerGuardado<T>(clave: string, leer: (crudo: unknown) => T | null): T | null {
  try {
    const crudo = localStorage.getItem(clave);
    if (!crudo) return null;
    return leer(clave === CLAVE_TEMA ? crudo : JSON.parse(crudo));
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (modo privado): el tema vale solo en esta visita.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => leerGuardado(CLAVE_TEMA, leerTema) ?? "dark");
  const [customTheme, setCustomThemeState] = useState<CustomTheme>(
    () => leerGuardado(CLAVE_TEMA_PERSONAL, leerTemaPersonal) ?? TEMA_PERSONAL_INICIAL
  );

  useEffect(() => {
    const root = document.documentElement;
    const base = baseDelTema(theme, customTheme);
    root.dataset.theme = theme;
    root.dataset.base = base;
    root.classList.toggle("dark", base === "dark");

    // El tema personal se pone encima de su base; los fijos usan solo index.css.
    const variables = theme === "custom" ? paletaPersonal(customTheme) : {};
    for (const nombre of Array.from(root.style)) {
      if (nombre.startsWith("--app-") && !(nombre in variables)) root.style.removeProperty(nombre);
    }
    for (const [nombre, valor] of Object.entries(variables)) root.style.setProperty(nombre, valor);

    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colorDeBarra(theme, customTheme));
    guardar(CLAVE_TEMA, theme);
    guardar(CLAVE_TEMA_PERSONAL, JSON.stringify(customTheme));
  }, [theme, customTheme]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((current) => (current === "dark" ? "pink" : "dark")),
      themeLabel: NOMBRES_TEMA[theme],
      customTheme,
      setCustomTheme: setCustomThemeState,
      isLight: baseDelTema(theme, customTheme) === "light"
    }),
    [theme, customTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
