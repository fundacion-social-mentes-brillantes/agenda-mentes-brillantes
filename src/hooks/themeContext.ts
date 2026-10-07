import { createContext } from "react";
import type { AppTheme } from "../types/theme";

// El contexto del tema vive aparte del proveedor (ThemeProvider.tsx) para que
// la recarga en caliente de Vite funcione: un archivo con componentes no debe
// exportar tambien otras cosas.
export interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  themeLabel: string;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
  themeLabel: "Noche Dorada"
});
