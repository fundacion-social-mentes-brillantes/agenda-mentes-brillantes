import { Timestamp } from "firebase/firestore";

/** Asistente / persona de sesiones coach. Vive en la colección top-level "clients" con workspaceId. */
export interface Client {
  id?: string;
  workspaceId: string;
  /** Código consecutivo (viene del programa contable; nuevos = siguiente número). */
  code: number;
  name: string;
  /** Nombre en minúsculas, para buscar sin tildes/mayúsculas. */
  nameLower: string;
  active: boolean;
  createdAt: Date | Timestamp;
}
