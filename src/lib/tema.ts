import type { AppTheme, CustomTheme, ThemeBase } from "../types/theme";

// Colores del tema que arma cada persona. De UN color elegido se sacan todos los
// demas (fondo, bordes, botones, textos) cuidando que siempre se puedan leer: si
// el color es muy claro para escribir encima del blanco, se oscurece lo justo, y
// al reves en el fondo oscuro.

/** Tema personal con el que arranca quien abre "Personalizado" por primera vez. */
export const TEMA_PERSONAL_INICIAL: CustomTheme = { base: "light", accent: "#8b7cf6" };

/** Colores para elegir con un toque (el selector libre permite cualquier otro). */
export const COLORES_SUGERIDOS: { value: string; label: string }[] = [
  { value: "#e5739b", label: "Rosa" },
  { value: "#f0a3c0", label: "Rosa claro" },
  { value: "#c084fc", label: "Lila" },
  { value: "#8b7cf6", label: "Lavanda" },
  { value: "#5b8def", label: "Azul" },
  { value: "#2b3a7a", label: "Azul del logo" },
  { value: "#38b2ac", label: "Turquesa" },
  { value: "#4caf7d", label: "Verde" },
  { value: "#d7b46a", label: "Dorado" },
  { value: "#f08a5d", label: "Coral" }
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

/** Oscurece (o aclara) el color lo justo para que se lea sobre el fondo. */
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

/** Base que corresponde a cada tema (para saber si la pantalla es clara u oscura). */
export function baseDelTema(tema: AppTheme, personal: CustomTheme): ThemeBase {
  if (tema === "pink") return "light";
  if (tema === "custom") return personal.base;
  return "dark";
}

/** Color de la barra del celular para cada tema. */
export function colorDeBarra(tema: AppTheme, personal: CustomTheme): string {
  if (tema === "pink") return "#fff9fb";
  if (tema === "custom") return paletaPersonal(personal)["--app-bg"];
  return "#0a1026";
}

/**
 * Todas las variables de color de un tema personal. Las de los temas fijos
 * (Noche Dorada y Rosa pastel) viven en index.css; estas se ponen encima.
 */
export function paletaPersonal(tema: CustomTheme): Record<string, string> {
  const acento = normalizarHex(tema.accent) ?? TEMA_PERSONAL_INICIAL.accent;

  if (tema.base === "dark") {
    const fondo = mezclar("#0a1026", acento, 0.06);
    const fondoSuave = mezclar("#111a3d", acento, 0.12);
    const panel = mezclar("#151d40", acento, 0.1);
    const acentoTexto = legibleSobre(acento, panel, 4.5);
    const gradienteMedio = mezclar(acento, "#ffffff", 0.15);
    const sobreAcento = contraste("#0c1020", gradienteMedio) >= contraste("#ffffff", gradienteMedio) ? "#0c1020" : "#ffffff";
    return {
      "--app-bg": fondo,
      "--app-bg-soft": fondoSuave,
      "--app-panel": transparente(panel, 84),
      "--app-panel-solid": panel,
      "--app-panel-gradient": `linear-gradient(158deg, ${transparente(mezclar(panel, acento, 0.08), 86)} 0%, ${transparente(fondo, 90)} 100%)`,
      "--app-soft": "rgba(255, 255, 255, 0.06)",
      "--app-border": transparente(acentoTexto, 22),
      "--app-border-strong": transparente(acentoTexto, 42),
      "--app-strong": "#f8f6f2",
      "--app-muted": legibleSobre(mezclar("#b9c1d8", acento, 0.12), panel, 4.5),
      "--app-faint": legibleSobre(mezclar("#7f89a3", acento, 0.12), panel, 3),
      "--app-accent": acentoTexto,
      "--app-accent-strong": mezclar(acentoTexto, "#ffffff", 0.35),
      "--app-accent-gradient": `linear-gradient(135deg, ${mezclar(acento, "#000000", 0.12)} 0%, ${gradienteMedio} 50%, ${mezclar(acento, "#ffffff", 0.4)} 100%)`,
      "--app-on-accent": sobreAcento,
      "--app-glow": transparente(acento, 20),
      "--app-glow-2": transparente(mezclar(acento, "#4f63d6", 0.5), 14),
      "--app-shadow": "0 26px 80px rgba(0, 0, 0, 0.5)",
      "--app-backdrop": "rgba(3, 6, 18, 0.6)"
    };
  }

  const fondo = mezclar("#ffffff", acento, 0.04);
  const fondoSuave = mezclar("#ffffff", acento, 0.14);
  const acentoTexto = legibleSobre(acento, "#ffffff", 4.5);
  const gradienteInicio = mezclar(acento, "#ffffff", 0.2);
  const gradienteFin = mezclar(acento, "#ffffff", 0.55);
  const gradienteMedio = mezclar(gradienteInicio, gradienteFin, 0.5);
  const textoOscuro = mezclar("#1d1720", acento, 0.25);
  const sobreAcento = contraste(textoOscuro, gradienteMedio) >= 4.5 ? textoOscuro : "#ffffff";
  return {
    "--app-bg": fondo,
    "--app-bg-soft": fondoSuave,
    "--app-panel": "rgba(255, 255, 255, 0.9)",
    "--app-panel-solid": "#ffffff",
    "--app-panel-gradient": "rgba(255, 255, 255, 0.9)",
    "--app-soft": transparente(acento, 11),
    "--app-border": transparente(acento, 24),
    "--app-border-strong": transparente(acentoTexto, 45),
    "--app-strong": legibleSobre(mezclar("#2a2230", acento, 0.18), fondoSuave, 7),
    "--app-muted": legibleSobre(mezclar("#6a5f70", acento, 0.2), fondoSuave, 4.5),
    "--app-faint": legibleSobre(mezclar("#9d93a3", acento, 0.2), fondo, 3),
    "--app-accent": acentoTexto,
    "--app-accent-strong": mezclar(acento, "#ffffff", 0.55),
    "--app-accent-gradient": `linear-gradient(135deg, ${gradienteInicio} 0%, ${gradienteFin} 100%)`,
    "--app-on-accent": sobreAcento,
    "--app-glow": transparente(acento, 26),
    "--app-glow-2": transparente(mezclar(acento, "#ffffff", 0.5), 40),
    "--app-shadow": `0 20px 60px ${transparente(acento, 14)}`,
    "--app-backdrop": transparente(mezclar(acento, "#000000", 0.6), 28)
  };
}

/** Lee un tema personal guardado (en el perfil o en el navegador) sin confiar en su forma. */
export function leerTemaPersonal(crudo: unknown): CustomTheme | null {
  if (!crudo || typeof crudo !== "object") return null;
  const fuente = crudo as Record<string, unknown>;
  const accent = normalizarHex(fuente.accent);
  if (!accent) return null;
  return { base: fuente.base === "dark" ? "dark" : "light", accent };
}

export function leerTema(crudo: unknown): AppTheme | null {
  return crudo === "dark" || crudo === "pink" || crudo === "custom" ? crudo : null;
}
