import { createContext } from "react";
import type { AppTheme, CustomTheme } from "../types/theme";
import { TEMA_PERSONAL_INICIAL } from "../lib/tema";

// El contexto del tema vive aparte del proveedor (ThemeProvider.tsx) para que
// la recarga en caliente de Vite funcione: un archivo con componentes no debe
// exportar tambien otras cosas.
export interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  themeLabel: string;
  /** El tema que arma cada persona (se usa cuando theme es "custom"). */
  customTheme: CustomTheme;
  setCustomTheme: (custom: CustomTheme) => void;
  /** true si lo que se ve es claro (Rosa pastel o un personalizado claro). */
  isLight: boolean;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
  themeLabel: "Noche Dorada",
  customTheme: TEMA_PERSONAL_INICIAL,
  setCustomTheme: () => {},
  isLight: false
});

export const NOMBRES_TEMA: Record<AppTheme, string> = {
  dark: "Noche Dorada",
  pink: "Rosa pastel",
  custom: "Mi color"
};
