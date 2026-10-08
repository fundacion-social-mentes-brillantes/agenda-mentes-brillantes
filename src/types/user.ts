import { Timestamp } from "firebase/firestore";
import type { AppTheme, CustomTheme } from "./theme";

export type UserRole = "admin" | "coach" | "family" | "viewer";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string | null;
  role: UserRole;
  color?: string;
  theme?: AppTheme;
  /** Color propio de la persona (tema "Personalizado"). */
  customTheme?: CustomTheme;
  active: boolean;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}
