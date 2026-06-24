import { doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Client } from "../types/client";

// Las personas (asistentes para sesiones coach) se guardan como un arreglo "clients"
// DENTRO del documento de la agenda (workspaces/{wsId}). Así reutilizamos los permisos
// existentes (los miembros leen la agenda; el dueño la edita) sin reglas nuevas.

/** Normaliza para buscar: minúsculas y sin tildes. */
export function normalizeText(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

interface StoredClient {
  code: number;
  name: string;
  nameLower?: string;
  active?: boolean;
  createdAt?: number;
}

function mapStored(c: StoredClient): Client {
  return {
    id: String(c.code),
    workspaceId: "",
    code: typeof c.code === "number" ? c.code : Number(c.code) || 0,
    name: c.name || "",
    nameLower: c.nameLower || normalizeText(c.name || ""),
    active: c.active !== false,
    createdAt: typeof c.createdAt === "number" ? new Date(c.createdAt) : new Date()
  };
}

async function readStored(workspaceId: string): Promise<StoredClient[]> {
  const snap = await getDoc(doc(db, "workspaces", workspaceId));
  const arr = snap.exists() ? (snap.data().clients as StoredClient[] | undefined) : undefined;
  return Array.isArray(arr) ? arr : [];
}

export const clientsService = {
  subscribeToClients(
    workspaceId: string,
    onUpdate: (clients: Client[]) => void,
    onError?: (error: unknown) => void
  ) {
    if (!workspaceId) {
      onUpdate([]);
      return () => {};
    }
    return onSnapshot(
      doc(db, "workspaces", workspaceId),
      (snap) => {
        const arr = snap.exists() ? (snap.data().clients as StoredClient[] | undefined) : undefined;
        const list = (Array.isArray(arr) ? arr : []).map(mapStored).sort((a, b) => a.name.localeCompare(b.name, "es"));
        onUpdate(list);
      },
      (error) => {
        console.error("Subscribe clients failed", error);
        if (onError) onError(error);
      }
    );
  },

  /** Crea una persona con el siguiente código consecutivo. */
  async createClient(workspaceId: string, name: string): Promise<Client> {
    if (!workspaceId) throw new Error("Falta la agenda.");
    const clean = name.trim();
    if (!clean) throw new Error("El nombre no puede estar vacío.");
    const current = await readStored(workspaceId);
    const code = current.reduce((m, c) => (c.code > m ? c.code : m), 0) + 1;
    const stored: StoredClient = { code, name: clean, nameLower: normalizeText(clean), active: true, createdAt: Date.now() };
    await updateDoc(doc(db, "workspaces", workspaceId), { clients: [...current, stored], updatedAt: serverTimestamp() });
    return mapStored(stored);
  },

  /** Importación masiva (CSV). Combina por código (sobrescribe los repetidos). */
  async importClients(workspaceId: string, rows: { code: number; name: string; active?: boolean }[]): Promise<number> {
    if (!workspaceId) throw new Error("Falta la agenda.");
    const current = await readStored(workspaceId);
    const byCode = new Map<number, StoredClient>();
    current.forEach((c) => byCode.set(c.code, c));
    let count = 0;
    for (const r of rows) {
      if (!r || !r.name || !Number.isFinite(r.code)) continue;
      const name = r.name.trim();
      byCode.set(r.code, { code: r.code, name, nameLower: normalizeText(name), active: r.active !== false, createdAt: Date.now() });
      count++;
    }
    const merged = [...byCode.values()].sort((a, b) => a.code - b.code);
    await updateDoc(doc(db, "workspaces", workspaceId), { clients: merged, updatedAt: serverTimestamp() });
    return count;
  }
};
