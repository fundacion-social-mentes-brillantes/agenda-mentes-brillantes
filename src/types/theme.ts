/**
 * Temas de la agenda:
 * - "dark": Noche Dorada, el azul y el dorado del logo (el de siempre).
 * - "pink": Rosa pastel, blanco con rosado suave.
 * - "custom": cada persona elige su color y si lo quiere claro u oscuro.
 */
export type AppTheme = "dark" | "pink" | "custom";

export type ThemeBase = "light" | "dark";

/** Tema que arma cada persona: un color principal sobre fondo claro u oscuro. */
export interface CustomTheme {
  base: ThemeBase;
  /** Color principal en hexadecimal, ej. "#e5739b". */
  accent: string;
}
