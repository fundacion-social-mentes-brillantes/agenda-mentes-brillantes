import type { AttachmentKind, EventAttachment } from "../types/event";

// Subida de archivos a Cloudinary (plan gratuito, sin tarjeta).
// Requiere dos variables de entorno (build de Vite):
//   VITE_CLOUDINARY_CLOUD_NAME    -> el "cloud name" de tu cuenta
//   VITE_CLOUDINARY_UPLOAD_PRESET -> un "upload preset" sin firma (unsigned)

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB por archivo
const UPLOAD_TIMEOUT = 60_000;

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/rtf",
  "application/zip",
  "application/x-zip-compressed"
];
const ALLOWED_TYPES = [...IMAGE_TYPES, ...DOCUMENT_TYPES];

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

function kindForType(contentType: string): AttachmentKind {
  return contentType.startsWith("image/") ? "image" : "file";
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "archivo";
}

export const storageService = {
  /** ¿Está configurado Cloudinary? Si no, se ocultan las opciones de adjuntar. */
  isConfigured(): boolean {
    return Boolean(CLOUD_NAME && UPLOAD_PRESET);
  },

  isImageType(contentType: string): boolean {
    return contentType.startsWith("image/");
  },

  validateFile(file: File) {
    const type = file.type || "application/octet-stream";
    const looksAllowed = ALLOWED_TYPES.includes(type) || type.startsWith("image/");
    if (!looksAllowed) {
      throw new Error("Tipo de archivo no permitido. Usa imágenes, PDF, Word, Excel, PowerPoint o texto.");
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Cada archivo no puede superar 15 MB.");
    }
  },

  async uploadAttachment(file: File, workspaceId: string, eventId: string): Promise<EventAttachment> {
    this.validateFile(file);
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      throw new Error("Los archivos no están configurados todavía (falta Cloudinary). Avisa para terminar la configuración.");
    }

    const contentType = file.type || "application/octet-stream";
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", UPLOAD_PRESET);
    form.append("folder", `agenda/${workspaceId}/${eventId}`);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
        method: "POST",
        body: form,
        signal: controller.signal
      });

      if (!response.ok) {
        let message = "No se pudo subir el archivo.";
        try {
          const errorData = await response.json();
          if (errorData?.error?.message) message = `Cloudinary: ${errorData.error.message}`;
        } catch {
          /* sin cuerpo JSON */
        }
        throw new Error(message);
      }

      const data = await response.json();
      return {
        url: data.secure_url || data.url,
        path: data.public_id || "",
        name: sanitizeName(file.name),
        contentType,
        size: typeof data.bytes === "number" ? data.bytes : file.size,
        kind: kindForType(contentType)
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("La subida del archivo tardó demasiado. Revisa tu conexión e intenta de nuevo.");
      }
      throw error instanceof Error ? error : new Error("No se pudo subir el archivo.");
    } finally {
      window.clearTimeout(timer);
    }
  },

  /**
   * En Cloudinary gratuito no se puede borrar desde el navegador sin la clave secreta.
   * Solo quitamos la referencia del evento; el archivo queda en Cloudinary (espacio gratuito amplio).
   */
  async deleteAttachment(_path: string) {
    return;
  }
};
