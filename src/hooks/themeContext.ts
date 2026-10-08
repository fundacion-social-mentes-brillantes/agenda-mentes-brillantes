import { createContext } from "react";
import type { Apariencia, ThemeBase } from "../types/theme";
import { APARIENCIA_PREDETERMINADA } from "../lib/tema";

// El contexto del tema vive aparte del proveedor (ThemeProvider.tsx) para que
// la recarga en caliente de Vite funcione: un archivo con componentes no debe
// exportar tambien otras cosas.
export interface ThemeContextType {
  /** Lo que la persona eligió: modo (claro, oscuro, automático) y color principal. */
  apariencia: Apariencia;
  /** Cambia la apariencia en pantalla (guardarla en el perfil es aparte). */
  setApariencia: (apariencia: Apariencia) => void;
  /** Lo que se ve de verdad, ya resuelto el modo automático. */
  base: ThemeBase;
  /** true si lo que se ve es claro. */
  isLight: boolean;
  /** Pasa de claro a oscuro y viceversa (botón de la pantalla de entrada). */
  toggleTheme: () => void;
  themeLabel: string;
}

export const ThemeContext = createContext<ThemeContextType>({
  apariencia: APARIENCIA_PREDETERMINADA,
  setApariencia: () => {},
  base: "dark",
  isLight: false,
  toggleTheme: () => {},
  themeLabel: "Oscuro"
});
