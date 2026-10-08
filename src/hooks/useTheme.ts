import { useCallback, useContext } from "react";
import { ThemeContext } from "./themeContext";
import { useAuth } from "./useAuth";
import { authService } from "../services/authService";
import type { Apariencia } from "../types/theme";

export { ThemeProvider } from "./ThemeProvider";

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Aplica la apariencia en pantalla al instante y la guarda en el perfil, para que
 * la persona la encuentre igual en su celular y en el computador.
 */
export function useGuardarApariencia() {
  const { setApariencia } = useTheme();
  const { profile } = useAuth();
  const uid = profile?.uid;

  return useCallback(
    async (apariencia: Apariencia) => {
      setApariencia(apariencia);
      if (!uid) return;
      try {
        await authService.updateApariencia(uid, apariencia);
      } catch (error) {
        console.error("No se pudo guardar la apariencia en el perfil:", error);
      }
    },
    [setApariencia, uid]
  );
}
