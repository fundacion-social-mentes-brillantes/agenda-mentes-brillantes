import { useContext } from "react";
import { ThemeContext } from "./themeContext";

export { ThemeProvider } from "./ThemeProvider";

export function useTheme() {
  return useContext(ThemeContext);
}
