// Fotos para el modo Experto del asistente (un horario, una lista de citas, un
// pantallazo). Se achican en el celular antes de mandarlas: una foto de cámara
// pesa 3-8 MB y el servidor no recibe más de ~4 MB; a este tamaño se sigue
// leyendo todo y pesa unos cientos de KB. No se guardan en ningún lado.

export interface FotoChat {
  /** Imagen en base64, sin el "data:..." del principio. */
  data: string;
  tipo: "image/jpeg";
  /** La misma imagen lista para mostrarla en pantalla. */
  vista: string;
}

// Lado más largo: más no mejora la lectura y solo gasta datos.
const LADO_MAX_FOTO = 1568;
const MAX_FOTO_CHARS = 3_800_000;

/** Achica la foto y la pasa a JPEG (también las HEIC del iPhone, si el navegador las abre). */
export async function prepararFoto(file: File): Promise<FotoChat> {
  if (!file.type.startsWith("image/")) throw new Error("Ese archivo no es una foto.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error("No pude abrir esa foto. Prueba con otra."));
      i.src = url;
    });
    const escala = Math.min(1, LADO_MAX_FOTO / Math.max(img.naturalWidth, img.naturalHeight));
    const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
    const alto = Math.max(1, Math.round(img.naturalHeight * escala));
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) throw new Error("No pude preparar la foto.");
    // Fondo blanco: un PNG transparente no debe quedar negro al pasar a JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(img, 0, 0, ancho, alto);
    const vista = lienzo.toDataURL("image/jpeg", 0.82);
    const data = vista.slice(vista.indexOf(",") + 1);
    if (data.length > MAX_FOTO_CHARS) throw new Error("La foto quedó muy pesada. Prueba con otra.");
    return { data, tipo: "image/jpeg", vista };
  } finally {
    URL.revokeObjectURL(url);
  }
}
