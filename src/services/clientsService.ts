import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { toDateSafe } from "../lib/dateUtils";
import type { Client } from "../types/client";

// Las personas (asistentes para sesiones coach) se guardan como documentos en la
// colección "events" con recordType: "client". Así reutilizamos las reglas de eventos
// (cualquier MIEMBRO de la agenda puede crear/leer/editar) sin reglas nuevas ni ser dueño.
// El calendario filtra estos documentos para no mostrarlos como eventos.
const CLIENT_TYPE = "client";

/** Normaliza para buscar: minúsculas y sin tildes. */
export function normalizeText(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function clientDocId(workspaceId: string, code: number): string {
  return `client_${workspaceId}_${code}`;
}

function mapDoc(id: string, data: Record<string, any>): Client {
  const name = data.clientName || "";
  return {
    id,
    workspaceId: data.workspaceId || "",
    code: typeof data.clientCode === "number" ? data.clientCode : Number(data.clientCode) || 0,
    name,
    nameLower: data.nameLower || normalizeText(name),
    active: data.active !== false,
    createdAt: toDateSafe(data.createdAt, new Date())
  };
}

function buildDocData(workspaceId: string, code: number, name: string, active: boolean, uid: string) {
  return {
    workspaceId,
    recordType: CLIENT_TYPE,
    clientCode: code,
    clientName: name,
    nameLower: normalizeText(name),
    active,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
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
    const q = query(collection(db, "events"), where("workspaceId", "==", workspaceId));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs
          .filter((d) => d.data().recordType === CLIENT_TYPE)
          .map((d) => mapDoc(d.id, d.data()))
          .sort((a, b) => a.name.localeCompare(b.name, "es"));
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
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Debes iniciar sesión.");
    const clean = name.trim();
    if (!clean) throw new Error("El nombre no puede estar vacío.");

    const snap = await getDocs(query(collection(db, "events"), where("workspaceId", "==", workspaceId)));
    const code =
      snap.docs
        .filter((d) => d.data().recordType === CLIENT_TYPE)
        .reduce((m, d) => {
          const c = Number(d.data().clientCode) || 0;
          return c > m ? c : m;
        }, 0) + 1;

    await setDoc(doc(db, "events", clientDocId(workspaceId, code)), buildDocData(workspaceId, code, clean, true, uid));
    return { id: clientDocId(workspaceId, code), workspaceId, code, name: clean, nameLower: normalizeText(clean), active: true, createdAt: new Date() };
  },

  /**
   * Edita una persona: nombre y/o código. El código NO se puede repetir.
   * Como el código está en el id del documento, cambiarlo crea un documento nuevo
   * (con el código correcto) y borra el viejo; además reasigna las sesiones coach
   * que apuntaban al código anterior para no perder el historial. Todo en un batch.
   */
  async updateClient(
    workspaceId: string,
    client: { id: string; code: number; name: string; active?: boolean },
    updates: { code: number; name: string }
  ): Promise<Client> {
    if (!workspaceId) throw new Error("Falta la agenda.");
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Debes iniciar sesión.");

    const newName = (updates.name || "").trim();
    if (!newName) throw new Error("El nombre no puede estar vacío.");
    const newCode = Math.floor(Number(updates.code));
    if (!Number.isFinite(newCode) || newCode < 1) throw new Error("El código debe ser un número entero mayor que 0.");

    const active = client.active !== false;
    const codeChanged = newCode !== client.code;
    const nameChanged = newName !== client.name;
    if (!codeChanged && !nameChanged) {
      return { id: client.id, workspaceId, code: client.code, name: client.name, nameLower: normalizeText(client.name), active, createdAt: new Date() };
    }

    const batch = writeBatch(db);

    if (codeChanged) {
      // El nuevo código no puede estar ocupado por OTRA persona.
      const targetId = clientDocId(workspaceId, newCode);
      const target = await getDoc(doc(db, "events", targetId));
      if (target.exists() && target.data()?.recordType === CLIENT_TYPE) {
        throw new Error(`Ya existe una persona con el código ${newCode}. Elige otro número.`);
      }
      batch.set(doc(db, "events", targetId), buildDocData(workspaceId, newCode, newName, active, uid));
      batch.delete(doc(db, "events", client.id));
    } else {
      batch.update(doc(db, "events", client.id), {
        clientName: newName,
        nameLower: normalizeText(newName),
        updatedAt: serverTimestamp()
      });
    }

    // Reasignar las sesiones coach de esta persona (código viejo) al nuevo código/nombre.
    const evSnap = await getDocs(query(collection(db, "events"), where("workspaceId", "==", workspaceId)));
    evSnap.docs
      .filter((d) => {
        const data = d.data();
        return data.recordType !== CLIENT_TYPE && data.kind === "coach" && Number(data.clientCode) === client.code;
      })
      .forEach((d) => batch.update(d.ref, { clientCode: newCode, clientName: newName, updatedAt: serverTimestamp() }));

    await batch.commit();

    const finalId = codeChanged ? clientDocId(workspaceId, newCode) : client.id;
    return { id: finalId, workspaceId, code: newCode, name: newName, nameLower: normalizeText(newName), active, createdAt: new Date() };
  },

  /** Importación masiva (CSV). Escribe en lotes de 450. Idempotente por (workspace, code). */
  async importClients(workspaceId: string, rows: { code: number; name: string; active?: boolean }[]): Promise<number> {
    if (!workspaceId) throw new Error("Falta la agenda.");
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Debes iniciar sesión.");
    const valid = rows.filter((r) => r && r.name && Number.isFinite(r.code));
    const CHUNK = 450;
    for (let i = 0; i < valid.length; i += CHUNK) {
      const batch = writeBatch(db);
      valid.slice(i, i + CHUNK).forEach((r) => {
        batch.set(doc(db, "events", clientDocId(workspaceId, r.code)), buildDocData(workspaceId, r.code, r.name.trim(), r.active !== false, uid));
      });
      await batch.commit();
    }
    return valid.length;
  }
};
