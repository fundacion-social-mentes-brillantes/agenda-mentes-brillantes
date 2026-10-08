/**
 * Apariencia de la agenda (la elige cada persona en Ajustes y se guarda en su perfil):
 * - modo: claro, oscuro o automático (sigue al celular / computador).
 * - acento: el color principal. Por defecto, el violeta del logo de Agenda MB; de él
 *   salen el color secundario (azul), los brillos y todo lo demás.
 */
export type ModoTema = "auto" | "claro" | "oscuro";

export interface Apariencia {
  modo: ModoTema;
  /** Color principal en hexadecimal, ej. "#5b2dff". */
  acento: string;
}

/** Lo que se ve en pantalla después de resolver el modo automático. */
export type ThemeBase = "light" | "dark";

/** @deprecated formato anterior (octubre 2026); solo se lee para convertirlo. */
export type AppTheme = "dark" | "pink" | "custom";

/** @deprecated formato anterior (octubre 2026); solo se lee para convertirlo. */
export interface CustomTheme {
  base: ThemeBase;
  accent: string;
}
