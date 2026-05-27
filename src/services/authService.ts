import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { UserProfile, UserRole } from "../types/user";

export const authService = {
  // Sign in with email and password
  async login(email: string, password: string): Promise<FirebaseUser> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  // Sign up and create a Firestore profile doc
  async register(email: string, password: string, name: string, role: UserRole = "family"): Promise<FirebaseUser> {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const profile: UserProfile = {
      uid: user.uid,
      name,
      email,
      role,
      color: this.getRandomColorForUser(),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save profile to Firestore
    await setDoc(doc(db, "users", user.uid), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return user;
  },

  // Sign out
  async logout(): Promise<void> {
    await signOut(auth);
  },

  // Get user profile from Firestore
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  },

  // Helper to assign a soft color to user avatar
  getRandomColorForUser(): string {
    const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#ec4899", "#f59e0b"];
    return colors[Math.floor(Math.random() * colors.length)];
  }
};
