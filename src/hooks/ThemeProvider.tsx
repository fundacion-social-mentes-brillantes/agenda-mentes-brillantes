import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AppTheme } from "../types/theme";
import { ThemeContext, type ThemeContextType } from "./themeContext";

function getInitialTheme(): AppTheme {
  const saved = localStorage.getItem("theme");
  return saved === "pink" ? "pink" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("theme-pink", theme === "pink");
    root.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((current) => (current === "dark" ? "pink" : "dark")),
      themeLabel: theme === "dark" ? "Noche Dorada" : "Pink Brillante"
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
