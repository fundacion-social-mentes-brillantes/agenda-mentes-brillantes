import { Timestamp } from "firebase/firestore";

export type WorkspaceKind = "personal" | "shared";
export type MemberRole = "owner" | "editor";

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  ownerName?: string;
  color?: string;
  kind: WorkspaceKind;
  /** Código para unirse a una agenda compartida (solo agendas compartidas). */
  joinCode?: string;
  /** Si está activado, otras personas pueden unirse con el enlace/código. */
  joinEnabled?: boolean;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface WorkspaceMember {
  uid: string;
  name: string;
  email: string;
  photoURL?: string | null;
  color?: string;
  role: MemberRole;
  joinedAt: Date | Timestamp;
}

/** Vista combinada de una agenda con el rol del usuario actual. */
export interface WorkspaceWithRole extends Workspace {
  myRole: MemberRole;
}
