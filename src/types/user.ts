import { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "coach" | "family" | "viewer";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  color?: string;
  active: boolean;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}
