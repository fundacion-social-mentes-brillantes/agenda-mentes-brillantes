import { useCallback, useContext } from "react";
import { ThemeContext } from "./themeContext";
import { useAuth } from "./useAuth";
import { authService } from "../services/authService";
import type { AppTheme, CustomTheme } from "../types/theme";

export { ThemeProvider } from "./ThemeProvider";

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Cambia el tema en pantalla al instante y lo guarda en el perfil, para que la
 * persona lo encuentre igual en su celular y en el computador.
 *
 * No vuelve a leer el perfil después de guardar: mientras alguien arrastra el
 * selector de color, esa lectura traería un color ya viejo y la pantalla saltaría.
 */
export function useGuardarTema() {
  const { setTheme, setCustomTheme, customTheme } = useTheme();
  const { profile } = useAuth();
  const uid = profile?.uid;

  return useCallback(
    async (tema: AppTheme, personal?: CustomTheme) => {
      setTheme(tema);
      if (personal) setCustomTheme(personal);
      if (!uid) return;
      try {
        await authService.updateUserTheme(uid, tema, personal ?? (tema === "custom" ? customTheme : undefined));
      } catch (error) {
        console.error("No se pudo guardar el tema en el perfil:", error);
      }
    },
    [setTheme, setCustomTheme, customTheme, uid]
  );
}
