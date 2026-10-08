import { toDate } from "./dateUtils";
import { normalizarHex, paleta } from "./tema";
import type { CalendarEvent } from "../types/event";
import type { Apariencia, ThemeBase } from "../types/theme";

// "Captura" de la agenda de un día: una imagen con TODAS las citas del día (también
// las que no caben en la pantalla), con los colores que la persona eligió, lista para
// mandar por WhatsApp o guardar. Se dibuja aparte (no es un pantallazo de la página):
// así sale nítida en cualquier celular y no depende de lo que esté a la vista.
// No lleva valores de plata: es para compartir.

const ANCHO = 1080;
const MARGEN = 72;
const ALTO_FILA = 128;
const SEPARACION = 16;

interface Colores {
  fondo: string;
  fondoSuave: string;
  fuerte: string;
  suave: string;
  tenue: string;
  acento: string;
  destello: string;
  tarjeta: string;
  borde: string;
}

function conAlfa(hex: string, alfa: number): string {
  const h = normalizarHex(hex) ?? "#000000";
  return `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, ${alfa})`;
}

function coloresDe(apariencia: Apariencia, base: ThemeBase): Colores {
  const p = paleta(apariencia.acento, base, { fondo: apariencia.fondo, destello: apariencia.destello });
  const oscuro = base === "dark";
  return {
    fondo: p["--app-bg"],
    fondoSuave: p["--app-bg-soft"],
    fuerte: p["--app-strong"],
    suave: p["--app-muted"],
    tenue: p["--app-faint"],
    acento: p["--app-accent"],
    destello: normalizarHex(apariencia.destello) ?? normalizarHex(apariencia.acento) ?? "#5b2dff",
    tarjeta: oscuro ? "rgba(255, 255, 255, 0.07)" : "rgba(255, 255, 255, 0.78)",
    borde: oscuro ? "rgba(255, 255, 255, 0.12)" : conAlfa(p["--app-accent"], 0.14)
  };
}

function hora(fecha: Date): string {
  return fecha.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Recorta el texto con "…" para que quepa en el ancho dado. */
function recortar(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let corto = texto;
  while (corto.length > 1 && ctx.measureText(`${corto}…`).width > ancho) corto = corto.slice(0, -1);
  return `${corto.trimEnd()}…`;
}

function rectanguloRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

function detalleDe(event: CalendarEvent): string {
  const partes: string[] = [];
  if (event.kind === "coach") partes.push("Sesión coach");
  if (event.modality === "virtual") partes.push("Virtual");
  if (event.modality === "presencial") partes.push("Presencial");
  return partes.join(" · ");
}

export interface DatosCaptura {
  fecha: Date;
  eventos: CalendarEvent[];
  apariencia: Apariencia;
  base: ThemeBase;
  /** Aclaración opcional bajo la fecha (ej. "Solo sesiones coach"). */
  nota?: string;
}

/** Dibuja la agenda del día y la devuelve como imagen PNG. */
export async function crearImagenDelDia({ fecha, eventos, apariencia, base, nota }: DatosCaptura): Promise<Blob> {
  const c = coloresDe(apariencia, base);
  const familia = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  await document.fonts?.ready;
  const icono = await cargarImagen("/icons/icon-192.png");

  const altoCabeza = 372;
  const altoLista = eventos.length ? eventos.length * (ALTO_FILA + SEPARACION) - SEPARACION : 220;
  const alto = Math.max(900, altoCabeza + altoLista + 150);

  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Este navegador no pudo crear la imagen.");

  // Fondo como el de la app: degradado y dos luces (principal arriba, destello abajo).
  const degradado = ctx.createLinearGradient(0, 0, ANCHO, alto);
  degradado.addColorStop(0, c.fondo);
  degradado.addColorStop(1, c.fondoSuave);
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, ANCHO, alto);
  for (const [x, y, color, alfa] of [
    [0, 0, apariencia.acento, base === "dark" ? 0.42 : 0.22],
    [ANCHO, alto, c.destello, base === "dark" ? 0.32 : 0.2]
  ] as const) {
    const luz = ctx.createRadialGradient(x, y, 0, x, y, ANCHO * 0.75);
    luz.addColorStop(0, conAlfa(color, alfa));
    luz.addColorStop(1, conAlfa(color, 0));
    ctx.fillStyle = luz;
    ctx.fillRect(0, 0, ANCHO, alto);
  }

  // Cabeza: ícono, nombre de la app y la fecha.
  if (icono) {
    ctx.save();
    rectanguloRedondo(ctx, MARGEN, MARGEN, 84, 84, 22);
    ctx.clip();
    ctx.drawImage(icono, MARGEN, MARGEN, 84, 84);
    ctx.restore();
  }
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.fuerte;
  ctx.font = `600 32px ${familia}`;
  ctx.fillText("Agenda MB", MARGEN + 108, MARGEN + 38);
  ctx.fillStyle = c.tenue;
  ctx.font = `400 24px ${familia}`;
  ctx.fillText("Gimnasio Emocional Mentes Brillantes", MARGEN + 108, MARGEN + 72);

  const titulo = fecha.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  ctx.fillStyle = c.fuerte;
  ctx.font = `700 60px ${familia}`;
  ctx.fillText(recortar(ctx, titulo.charAt(0).toUpperCase() + titulo.slice(1), ANCHO - MARGEN * 2), MARGEN, MARGEN + 190);
  ctx.fillStyle = c.suave;
  ctx.font = `400 30px ${familia}`;
  const cuenta = eventos.length === 0 ? "Día libre" : `${eventos.length} ${eventos.length === 1 ? "cita" : "citas"}`;
  ctx.fillText(nota ? `${cuenta} · ${nota}` : cuenta, MARGEN, MARGEN + 238);

  // Las citas.
  let y = altoCabeza;
  const anchoTarjeta = ANCHO - MARGEN * 2;
  if (eventos.length === 0) {
    ctx.fillStyle = c.tenue;
    ctx.font = `400 34px ${familia}`;
    ctx.fillText("No hay nada agendado este día.", MARGEN, y + 60);
  }
  for (const event of eventos) {
    rectanguloRedondo(ctx, MARGEN, y, anchoTarjeta, ALTO_FILA, 28);
    ctx.fillStyle = c.tarjeta;
    ctx.fill();
    ctx.strokeStyle = c.borde;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Barra con el color de la cita.
    rectanguloRedondo(ctx, MARGEN + 20, y + 22, 10, ALTO_FILA - 44, 5);
    ctx.fillStyle = normalizarHex(event.color) ?? c.acento;
    ctx.fill();

    const inicio = toDate(event.startAt);
    const fin = toDate(event.endAt);
    const xHora = MARGEN + 52;
    ctx.fillStyle = c.fuerte;
    if (event.allDay) {
      ctx.font = `600 28px ${familia}`;
      ctx.fillText("Todo el día", xHora, y + 74);
    } else {
      ctx.font = `600 32px ${familia}`;
      ctx.fillText(hora(inicio), xHora, y + 58);
      ctx.fillStyle = c.tenue;
      ctx.font = `400 26px ${familia}`;
      ctx.fillText(hora(fin), xHora, y + 94);
    }

    const xTitulo = MARGEN + 250;
    const anchoTitulo = anchoTarjeta - (xTitulo - MARGEN) - 32;
    const detalle = detalleDe(event);
    ctx.fillStyle = c.fuerte;
    ctx.font = `600 36px ${familia}`;
    ctx.fillText(recortar(ctx, event.title || "Sin título", anchoTitulo), xTitulo, detalle ? y + 58 : y + 76);
    if (detalle) {
      ctx.fillStyle = c.tenue;
      ctx.font = `400 26px ${familia}`;
      ctx.fillText(recortar(ctx, detalle, anchoTitulo), xTitulo, y + 96);
    }
    y += ALTO_FILA + SEPARACION;
  }

  // Pie.
  ctx.fillStyle = c.tenue;
  ctx.font = `400 22px ${familia}`;
  ctx.textAlign = "center";
  ctx.fillText("Hecho con Agenda MB", ANCHO / 2, alto - 56);

  return new Promise((ok, mal) => lienzo.toBlob((blob) => (blob ? ok(blob) : mal(new Error("No se pudo crear la imagen."))), "image/png"));
}

/** Nombre del archivo: agenda-2026-10-08.png */
export function nombreDeCaptura(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `agenda-${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}.png`;
}
