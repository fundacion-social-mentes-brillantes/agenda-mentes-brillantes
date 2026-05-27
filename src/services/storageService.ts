import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { withTimeout } from "../lib/asyncUtils";
import { storage } from "../lib/firebase";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const STORAGE_TIMEOUT = 30_000;

function getStorageErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "storage/unauthorized") {
    return "No tienes permiso para subir imagenes. Revisa que Firebase Storage este activado y que las reglas permitan usuarios autenticados.";
  }
  if (code === "storage/canceled") {
    return "La subida de la imagen fue cancelada.";
  }
  if (code === "storage/quota-exceeded") {
    return "Firebase Storage no tiene cuota disponible para subir esta imagen.";
  }
  return "No se pudo subir la imagen. Verifica Firebase Storage y vuelve a intentarlo.";
}

export const storageService = {
  validateImage(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error("Solo se permiten imagenes JPG, JPEG, PNG o WEBP.");
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error("La imagen no puede superar 5 MB.");
    }
  },

  async uploadEventImage(file: File, eventId: string, userId: string) {
    this.validateImage(file);
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const imagePath = `event-images/${userId}/${eventId}/${safeName}`;
    const imageRef = ref(storage, imagePath);

    try {
      await withTimeout(
        uploadBytes(imageRef, file, { contentType: file.type }),
        STORAGE_TIMEOUT,
        "La subida de la imagen tardó demasiado."
      );
      const imageUrl = await withTimeout(
        getDownloadURL(imageRef),
        STORAGE_TIMEOUT,
        "No pudimos obtener la URL de la imagen."
      );
      return { imageUrl, imagePath };
    } catch (error) {
      throw new Error(getStorageErrorMessage(error));
    }
  },

  async deleteEventImage(imagePath: string) {
    try {
      await withTimeout(
        deleteObject(ref(storage, imagePath)),
        STORAGE_TIMEOUT,
        "La eliminación de la imagen tardó demasiado."
      );
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "storage/object-not-found") {
        throw new Error(getStorageErrorMessage(error));
      }
    }
  }
};
