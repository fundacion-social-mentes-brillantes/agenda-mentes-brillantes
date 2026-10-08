import type { Apariencia, ModoTema, ThemeBase } from "../types/theme";

// Colores de la agenda. La identidad sale del logo de Agenda MB: fondo índigo casi
// negro, violeta eléctrico como color principal y azul brillante / cian como
// secundario, con brillos blancos suaves. De UN color principal se calculan todos
// los demás (fondo, cristal, bordes, botones, textos) cuidando que siempre se
// puedan leer: si el color no se lee sobre el fondo, se aclara u oscurece lo justo.

/** Violeta eléctrico del logo de Agenda MB. */
export const ACENTO_AGENDA_MB = "#5b2dff";

export const APARIENCIA_PREDETERMINADA: Apariencia = { modo: "oscuro", acento: ACENTO_AGENDA_MB };

/** Colores para elegir con un toque (la rueda permite cualquier otro). */
export const COLORES_SUGERIDOS: { value: string; label: string }[] = [
  { value: ACENTO_AGENDA_MB, label: "Violeta Agenda MB" },
  { value: "#7a4dff", label: "Morado brillante" },
  { value: "#2196f3", label: "Azul" },
  { value: "#46b8ff", label: "Cian" },
  { value: "#a78bfa", label: "Lavanda" },
  { value: "#f09ab9", label: "Rosa pastel" },
  { value: "#e5739b", label: "Rosa" },
  { value: "#f08a5d", label: "Coral" },
  { value: "#34c3a0", label: "Verde menta" },
  { value: "#d7b46a", label: "Dorado GEMB" }
];

type Rgb = [number, number, number];

/** "#abc" o "#aabbcc" (con o sin #) -> "#aabbcc". Lo demás -> null. */
export function normalizarHex(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(limpio)) return `#${limpio.split("").map((c) => c + c).join("")}`;
  if (/^[0-9a-f]{6}$/.test(limpio)) return `#${limpio}`;
  return null;
}

function aRgb(hex: string): Rgb {
  const h = normalizarHex(hex) ?? "#000000";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function aHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Mezcla dos colores: t = 0 deja el primero, t = 1 da el segundo. */
export function mezclar(a: string, b: string, t: number): string {
  const x = aRgb(a);
  const y = aRgb(b);
  return aHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

// --- Tono, saturación y brillo (la rueda de color y sus dos barras) ---

export interface Hsv {
  /** Tono, 0-360 (la vuelta de la rueda). */
  h: number;
  /** Saturación, 0-100. */
  s: number;
  /** Brillo, 0-100. */
  v: number;
}

export function hexAHsv(hex: string): Hsv {
  const [r, g, b] = aRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(max ? (d / max) * 100 : 0), v: Math.round(max * 100) };
}

export function hsvAHex({ h, s, v }: Hsv): string {
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const val = Math.min(100, Math.max(0, v)) / 100;
  const c = val * sat;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = val - c;
  const [r, g, b] =
    hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  return aHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

/** Color secundario: el mismo color girado hacia el azul (violeta -> azul brillante, como en el logo). */
export function colorSecundario(acento: string): string {
  const { h, s, v } = hexAHsv(acento);
  return hsvAHex({ h: h - 45, s: Math.max(s, 55), v: Math.max(v, 85) });
}

// --- Contraste ---

function luminancia(hex: string): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = aRgb(hex);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Contraste entre dos colores (1 a 21). Para leer texto normal hace falta 4.5. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Aclara (u oscurece) el color lo justo para que se lea sobre el fondo. */
export function legibleSobre(color: string, fondo: string, minimo = 4.5): string {
  if (contraste(color, fondo) >= minimo) return color;
  const hacia = luminancia(fondo) > 0.4 ? "#000000" : "#ffffff";
  for (let t = 0.05; t <= 1; t += 0.05) {
    const candidato = mezclar(color, hacia, t);
    if (contraste(candidato, fondo) >= minimo) return candidato;
  }
  return hacia;
}

function transparente(color: string, porcentaje: number): string {
  return `color-mix(in srgb, ${color} ${porcentaje}%, transparent)`;
}

// --- Modo ---

/** Claro u oscuro según lo elegido; "auto" sigue al aparato. */
export function resolverModo(modo: ModoTema, sistemaOscuro: boolean): ThemeBase {
  if (modo === "claro") return "light";
  if (modo === "oscuro") return "dark";
  return sistemaOscuro ? "dark" : "light";
}

/**
 * Todas las variables de color para una apariencia ya resuelta (clara u oscura).
 * Las usan index.css y cada pantalla a través de clases como text-app-accent.
 */
export function paleta(acentoCrudo: string, base: ThemeBase): Record<string, string> {
  const acento = normalizarHex(acentoCrudo) ?? ACENTO_AGENDA_MB;
  const secundario = colorSecundario(acento);

  if (base === "dark") {
    // Índigo casi negro del logo (#0B0820 / #15113A), apenas teñido con el color elegido.
    const fondo = mezclar("#0b0820", acento, 0.05);
    const fondoSuave = mezclar("#15113a", acento, 0.1);
    const solido = mezclar("#1a1544", acento, 0.1);
    const fuerte = "#f3f1ff";
    const acentoTexto = legibleSobre(mezclar(acento, "#ffffff", 0.2), solido, 4.5);
    const secundarioTexto = legibleSobre(secundario, solido, 4.5);
    const inicio = acento;
    const fin = mezclar(acento, secundario, 0.55);
    const medio = mezclar(inicio, fin, 0.5);
    const sobreAcento = contraste("#ffffff", medio) >= 3.2 ? "#ffffff" : "#0b0820";
    return {
      "--app-bg": fondo,
      "--app-bg-soft": fondoSuave,
      // Cristal: casi transparente, se ve lo de atrás desenfocado.
      "--app-panel": "rgba(255, 255, 255, 0.055)",
      "--app-panel-strong": "rgba(255, 255, 255, 0.09)",
      "--app-panel-solid": solido,
      "--app-soft": "rgba(255, 255, 255, 0.07)",
      "--app-border": "rgba(255, 255, 255, 0.11)",
      "--app-border-strong": transparente(acentoTexto, 55),
      "--app-highlight": "rgba(255, 255, 255, 0.14)",
      "--app-strong": fuerte,
      "--app-muted": legibleSobre(mezclar("#bdb7dc", acento, 0.08), solido, 4.5),
      "--app-faint": legibleSobre(mezclar("#8c86ad", acento, 0.08), solido, 3),
      "--app-accent": acentoTexto,
      "--app-accent-strong": mezclar(acentoTexto, "#ffffff", 0.35),
      "--app-accent-2": secundarioTexto,
      "--app-accent-gradient": `linear-gradient(135deg, ${inicio} 0%, ${fin} 100%)`,
      "--app-on-accent": sobreAcento,
      "--app-glow": transparente(acento, 42),
      "--app-glow-2": transparente(secundario, 30),
      "--app-ring": transparente(acento, 55),
      "--app-shadow": "0 24px 60px rgba(3, 2, 14, 0.55)",
      "--app-backdrop": "rgba(5, 3, 18, 0.62)",
      "--app-danger": "#ff6b7a"
    };
  }

  // Claro: blanco perlado (#F3F1FF del logo) con cristal blanco.
  const fondo = mezclar("#f7f6fc", acento, 0.04);
  const fondoSuave = mezclar("#ffffff", acento, 0.14);
  // Se mide contra el fondo más oscuro del modo claro (no contra blanco puro).
  const acentoTexto = legibleSobre(legibleSobre(acento, fondoSuave, 4.5), fondo, 4.5);
  const secundarioTexto = legibleSobre(legibleSobre(secundario, fondoSuave, 4.5), fondo, 4.5);
  const inicio = acento;
  const fin = mezclar(acento, secundario, 0.55);
  const medio = mezclar(inicio, fin, 0.5);
  const textoOscuro = mezclar("#1b1530", acento, 0.2);
  const sobreAcento = contraste("#ffffff", medio) >= 3.2 ? "#ffffff" : textoOscuro;
  return {
    "--app-bg": fondo,
    "--app-bg-soft": fondoSuave,
    "--app-panel": "rgba(255, 255, 255, 0.62)",
    "--app-panel-strong": "rgba(255, 255, 255, 0.8)",
    "--app-panel-solid": "#ffffff",
    "--app-soft": transparente(acento, 9),
    "--app-border": transparente(acento, 16),
    "--app-border-strong": transparente(acentoTexto, 45),
    "--app-highlight": "rgba(255, 255, 255, 0.9)",
    "--app-strong": legibleSobre(mezclar("#1b1530", acento, 0.12), fondoSuave, 7),
    "--app-muted": legibleSobre(mezclar("#5d5774", acento, 0.12), fondoSuave, 4.5),
    "--app-faint": legibleSobre(mezclar("#8f89a6", acento, 0.12), fondo, 3),
    "--app-accent": acentoTexto,
    "--app-accent-strong": mezclar(acento, "#ffffff", 0.55),
    "--app-accent-2": secundarioTexto,
    "--app-accent-gradient": `linear-gradient(135deg, ${inicio} 0%, ${fin} 100%)`,
    "--app-on-accent": sobreAcento,
    "--app-glow": transparente(acento, 24),
    "--app-glow-2": transparente(secundario, 20),
    "--app-ring": transparente(acento, 45),
    "--app-shadow": `0 18px 50px ${transparente(mezclar(acento, "#1b1530", 0.5), 14)}`,
    "--app-backdrop": transparente(mezclar(acento, "#0b0820", 0.7), 30),
    "--app-danger": "#dc2626"
  };
}

/** Color de la barra del celular. */
export function colorDeBarra(acento: string, base: ThemeBase): string {
  return paleta(acento, base)["--app-bg"];
}

/**
 * Lee la apariencia guardada (en el perfil o en el navegador) sin confiar en su forma.
 * También entiende el formato anterior: "dark" (Noche Dorada), "pink" (rosa) y
 * "custom" con su color: así nadie pierde lo que había elegido.
 */
export function leerApariencia(crudo: unknown, temaViejo?: unknown, personalViejo?: unknown): Apariencia | null {
  if (crudo && typeof crudo === "object") {
    const fuente = crudo as Record<string, unknown>;
    const acento = normalizarHex(fuente.acento);
    const modo = fuente.modo === "claro" || fuente.modo === "oscuro" || fuente.modo === "auto" ? fuente.modo : null;
    if (acento && modo) return { modo, acento };
  }
  if (temaViejo === "pink") return { modo: "claro", acento: "#f09ab9" };
  if (temaViejo === "custom" && personalViejo && typeof personalViejo === "object") {
    const viejo = personalViejo as Record<string, unknown>;
    const acento = normalizarHex(viejo.accent);
    if (acento) return { modo: viejo.base === "dark" ? "oscuro" : "claro", acento };
  }
  return null;
}

export function mismaApariencia(a: Apariencia, b: Apariencia): boolean {
  return a.modo === b.modo && normalizarHex(a.acento) === normalizarHex(b.acento);
}
