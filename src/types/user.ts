import { Timestamp } from "firebase/firestore";
import type { Apariencia, AppTheme, CustomTheme } from "./theme";

export type UserRole = "admin" | "coach" | "family" | "viewer";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string | null;
  role: UserRole;
  color?: string;
  /** Modo (claro, oscuro, automático) y color principal que eligió la persona. */
  apariencia?: Apariencia;
  /** @deprecated formato anterior; solo se lee para convertirlo a "apariencia". */
  theme?: AppTheme;
  /** @deprecated formato anterior; solo se lee para convertirlo a "apariencia". */
  customTheme?: CustomTheme;
  active: boolean;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}
