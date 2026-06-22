import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";
import { toDateSafe } from "../lib/dateUtils";
import { db } from "../lib/firebase";
import type { MemberRole, Workspace, WorkspaceMember, WorkspaceWithRole } from "../types/workspace";

const JOIN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos

export function generateJoinCode(length = 8): string {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += JOIN_ALPHABET[values[i] % JOIN_ALPHABET.length];
  }
  return code;
}

export function personalWorkspaceId(uid: string): string {
  return `personal_${uid}`;
}

function displayName(user: FirebaseUser): string {
  return user.displayName || user.email?.split("@")[0] || "Usuario";
}

function memberPayload(user: FirebaseUser, role: MemberRole, color?: string, joinCode?: string) {
  const payload: Record<string, unknown> = {
    uid: user.uid,
    name: displayName(user),
    email: (user.email || "").toLowerCase(),
    photoURL: user.photoURL || null,
    color: color || null,
    role,
    joinedAt: serverTimestamp()
  };
  if (joinCode) payload.joinCode = joinCode; // requerido por las reglas al unirse
  return payload;
}

function mapWorkspace(id: string, data: Record<string, any>): Workspace {
  return {
    id,
    name: data.name || "Agenda",
    ownerId: data.ownerId || "",
    ownerName: data.ownerName || "",
    color: data.color || undefined,
    kind: data.kind === "shared" ? "shared" : "personal",
    joinCode: data.joinCode || undefined,
    joinEnabled: data.joinEnabled !== false,
    createdAt: toDateSafe(data.createdAt, new Date()),
    updatedAt: toDateSafe(data.updatedAt, new Date())
  };
}

export const workspaceService = {
  /** Crea (si no existe) la agenda personal del usuario y su membresía. */
  async ensurePersonalWorkspace(user: FirebaseUser): Promise<Workspace> {
    const wsId = personalWorkspaceId(user.uid);
    const wsRef = doc(db, "workspaces", wsId);
    const existing = await getDoc(wsRef);

    if (!existing.exists()) {
      await setDoc(wsRef, {
        name: "Mi agenda",
        ownerId: user.uid,
        ownerName: displayName(user),
        kind: "personal",
        joinEnabled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    const memberRef = doc(db, "workspaces", wsId, "members", user.uid);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) {
      await setDoc(memberRef, memberPayload(user, "owner"));
    }

    const fresh = await getDoc(wsRef);
    return mapWorkspace(wsId, fresh.exists() ? fresh.data() : {});
  },

  /** Escucha en tiempo real todas las agendas a las que pertenece el usuario. */
  subscribeToMyWorkspaces(
    uid: string,
    onUpdate: (workspaces: WorkspaceWithRole[]) => void,
    onError?: (error: unknown) => void
  ) {
    const q = query(collectionGroup(db, "members"), where("uid", "==", uid));

    return onSnapshot(
      q,
      async (snapshot) => {
        const entries = snapshot.docs
          .map((docSnap) => {
            const wsRef = docSnap.ref.parent.parent;
            if (!wsRef) return null;
            return { wsId: wsRef.id, role: (docSnap.data().role as MemberRole) || "editor" };
          })
          .filter((item): item is { wsId: string; role: MemberRole } => item !== null);

        const workspaces = await Promise.all(
          entries.map(async ({ wsId, role }) => {
            try {
              const wsSnap = await getDoc(doc(db, "workspaces", wsId));
              if (!wsSnap.exists()) return null;
              return { ...mapWorkspace(wsId, wsSnap.data()), myRole: role } as WorkspaceWithRole;
            } catch {
              return null;
            }
          })
        );

        const list = workspaces.filter((ws): ws is WorkspaceWithRole => ws !== null);
        // Personal primero, luego por nombre.
        list.sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === "personal" ? -1 : 1;
          return a.name.localeCompare(b.name, "es");
        });
        onUpdate(list);
      },
      (error) => {
        console.error("Subscribe workspaces failed", error);
        if (onError) onError(error);
      }
    );
  },

  /** Crea una agenda compartida nueva con el usuario como dueño. */
  async createSharedWorkspace(user: FirebaseUser, name: string, color?: string): Promise<Workspace> {
    const wsRef = doc(collection(db, "workspaces"));
    await setDoc(wsRef, {
      name: name.trim() || "Agenda compartida",
      ownerId: user.uid,
      ownerName: displayName(user),
      color: color || null,
      kind: "shared",
      joinCode: generateJoinCode(),
      joinEnabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await setDoc(doc(db, "workspaces", wsRef.id, "members", user.uid), memberPayload(user, "owner", color));
    const fresh = await getDoc(wsRef);
    return mapWorkspace(wsRef.id, fresh.exists() ? fresh.data() : {});
  },

  /** Une al usuario a una agenda compartida usando el código de invitación. */
  async joinWorkspace(user: FirebaseUser, wsId: string, joinCode: string): Promise<Workspace> {
    const memberRef = doc(db, "workspaces", wsId, "members", user.uid);
    const already = await getDoc(memberRef);
    if (!already.exists()) {
      await setDoc(memberRef, memberPayload(user, "editor", undefined, joinCode.trim().toUpperCase()));
    }
    const wsSnap = await getDoc(doc(db, "workspaces", wsId));
    if (!wsSnap.exists()) {
      throw new Error("La agenda ya no existe.");
    }
    return mapWorkspace(wsId, wsSnap.data());
  },

  subscribeToMembers(wsId: string, onUpdate: (members: WorkspaceMember[]) => void) {
    return onSnapshot(collection(db, "workspaces", wsId, "members"), (snapshot) => {
      const members = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          uid: data.uid || docSnap.id,
          name: data.name || "Usuario",
          email: data.email || "",
          photoURL: data.photoURL || null,
          color: data.color || undefined,
          role: (data.role as MemberRole) || "editor",
          joinedAt: toDateSafe(data.joinedAt, new Date())
        } as WorkspaceMember;
      });
      members.sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.name.localeCompare(b.name, "es")));
      onUpdate(members);
    });
  },

  async renameWorkspace(wsId: string, name: string): Promise<void> {
    await updateDoc(doc(db, "workspaces", wsId), { name: name.trim(), updatedAt: serverTimestamp() });
  },

  async setJoinEnabled(wsId: string, enabled: boolean): Promise<void> {
    await updateDoc(doc(db, "workspaces", wsId), { joinEnabled: enabled, updatedAt: serverTimestamp() });
  },

  async regenerateJoinCode(wsId: string): Promise<string> {
    const code = generateJoinCode();
    await updateDoc(doc(db, "workspaces", wsId), { joinCode: code, joinEnabled: true, updatedAt: serverTimestamp() });
    return code;
  },

  async leaveWorkspace(wsId: string, uid: string): Promise<void> {
    await deleteDoc(doc(db, "workspaces", wsId, "members", uid));
  },

  async removeMember(wsId: string, uid: string): Promise<void> {
    await deleteDoc(doc(db, "workspaces", wsId, "members", uid));
  },

  /** Elimina una agenda compartida completa (eventos, miembros y la agenda). Solo el dueño. */
  async deleteWorkspace(wsId: string): Promise<void> {
    const eventsSnap = await getDocs(query(collection(db, "events"), where("workspaceId", "==", wsId)));
    const membersSnap = await getDocs(collection(db, "workspaces", wsId, "members"));

    const batch = writeBatch(db);
    eventsSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    membersSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    batch.delete(doc(db, "workspaces", wsId));
    await batch.commit();
  }
};
