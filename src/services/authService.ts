import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
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
import type { AppTheme } from "../types/theme";

function isMobileEnvironment(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function getFriendlyAuthError(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";

  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Correo o contrasena incorrectos. Verifica tus datos e intenta de nuevo.";
  }
  if (code === "auth/email-already-in-use") {
    return "Este correo electronico ya esta registrado.";
  }
  if (code === "auth/weak-password") {
    return "La contrasena debe tener al menos 6 caracteres.";
  }
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "La ventana de Google se cerro antes de completar el ingreso.";
  }
  if (code === "auth/unauthorized-domain") {
    return "Este dominio no esta autorizado en Firebase Auth.";
  }

  return "No pudimos iniciar sesion. Intenta de nuevo en unos segundos.";
}

export const authService = {
  async login(email: string, password: string): Promise<FirebaseUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await this.ensureUserProfile(userCredential.user);
      return userCredential.user;
    } catch (error) {
      throw new Error(getFriendlyAuthError(error));
    }
  },

  async register(email: string, password: string, name: string, role: UserRole = "family"): Promise<FirebaseUser> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const profile: UserProfile = {
        uid: user.uid,
        name,
        email,
        photoURL: user.photoURL,
        role,
        color: this.getRandomColorForUser(),
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, "users", user.uid), {
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return user;
    } catch (error) {
      throw new Error(getFriendlyAuthError(error));
    }
  },

  async signInWithGoogle(): Promise<FirebaseUser | null> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    if (isMobileEnvironment()) {
      await signInWithRedirect(auth, provider);
      return null;
    }

    try {
      const result = await signInWithPopup(auth, provider);
      await this.ensureUserProfile(result.user);
      return result.user;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      const shouldRedirect =
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment";

      if (shouldRedirect) {
        await signInWithRedirect(auth, provider);
        return null;
      }

      throw new Error(getFriendlyAuthError(error));
    }
  },

  async handleGoogleRedirectResult(): Promise<FirebaseUser | null> {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    await this.ensureUserProfile(result.user);
    return result.user;
  },

  async logout(): Promise<void> {
    await signOut(auth);
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  },

  async ensureUserProfile(user: FirebaseUser): Promise<UserProfile> {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    const existing = docSnap.exists() ? (docSnap.data() as Partial<UserProfile>) : null;
    const fallbackName = user.displayName || user.email?.split("@")[0] || "Usuario";
    const profileUpdate = {
      uid: user.uid,
      name: existing?.name || fallbackName,
      email: user.email || existing?.email || "",
      photoURL: user.photoURL || existing?.photoURL || null,
      role: existing?.role || "family",
      color: existing?.color || this.getRandomColorForUser(),
      theme: existing?.theme,
      active: true,
      updatedAt: serverTimestamp(),
      ...(existing?.createdAt ? {} : { createdAt: serverTimestamp() })
    };

    await setDoc(docRef, profileUpdate, { merge: true });
    const fresh = await getDoc(docRef);
    return fresh.data() as UserProfile;
  },

  async updateUserTheme(uid: string, theme: AppTheme): Promise<void> {
    await setDoc(
      doc(db, "users", uid),
      {
        theme,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  },

  getRandomColorForUser(): string {
    const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#ec4899", "#d97706"];
    return colors[Math.floor(Math.random() * colors.length)];
  }
};
