import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { withTimeout } from "../lib/asyncUtils";
import { storage } from "../lib/firebase";
import type { AttachmentKind, EventAttachment } from "../types/event";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB por archivo
const STORAGE_TIMEOUT = 60_000;

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

function getStorageErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "storage/unauthorized") {
    return "No tienes permiso para subir archivos. Revisa que Firebase Storage esté activado y que las reglas permitan a los miembros de la agenda.";
  }
  if (code === "storage/canceled") {
    return "La subida del archivo fue cancelada.";
  }
  if (code === "storage/quota-exceeded") {
    return "Firebase Storage no tiene cuota disponible para subir este archivo.";
  }
  return "No se pudo subir el archivo. Verifica Firebase Storage y vuelve a intentarlo.";
}

function kindForType(contentType: string): AttachmentKind {
  return contentType.startsWith("image/") ? "image" : "file";
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "archivo";
}

export const storageService = {
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
    const contentType = file.type || "application/octet-stream";
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const safeName = `${Date.now()}-${crypto.randomUUID()}${extension ? "." + extension : ""}`;
    const path = `attachments/${workspaceId}/${eventId}/${safeName}`;
    const fileRef = ref(storage, path);

    try {
      await withTimeout(
        uploadBytes(fileRef, file, { contentType }),
        STORAGE_TIMEOUT,
        "La subida del archivo tardó demasiado."
      );
      const url = await withTimeout(
        getDownloadURL(fileRef),
        STORAGE_TIMEOUT,
        "No pudimos obtener el enlace del archivo."
      );
      return {
        url,
        path,
        name: sanitizeName(file.name),
        contentType,
        size: file.size,
        kind: kindForType(contentType)
      };
    } catch (error) {
      throw new Error(getStorageErrorMessage(error));
    }
  },

  async deleteAttachment(path: string) {
    if (!path) return;
    try {
      await withTimeout(
        deleteObject(ref(storage, path)),
        STORAGE_TIMEOUT,
        "La eliminación del archivo tardó demasiado."
      );
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "storage/object-not-found") {
        // No bloqueamos al usuario por un archivo huérfano; lo registramos.
        console.warn("No se pudo eliminar el archivo de Storage", path, error);
      }
    }
  }
};
