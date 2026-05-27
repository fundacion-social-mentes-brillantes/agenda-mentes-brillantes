import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { AppTheme } from "../types/theme";
import type { UserProfile, UserRole } from "../types/user";

export const PROFILE_SYNC_WARNING = "Ingresaste, pero no pudimos sincronizar tu perfil todavía.";

interface ProfileSyncResult {
  profile: UserProfile;
  warning: string | null;
}

function isMobileEnvironment(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function getErrorDetails(error: unknown) {
  const maybeError = error as { code?: string; message?: string; name?: string };
  return {
    code: maybeError?.code || "",
    message: maybeError?.message || "",
    name: maybeError?.name || "",
    originalError: error
  };
}

function logGoogleSignInFailure(error: unknown) {
  console.error("Google sign-in failed", getErrorDetails(error));
}

function getFriendlyAuthError(error: unknown): string {
  const { code } = getErrorDetails(error);

  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.";
  }
  if (code === "auth/email-already-in-use") {
    return "Este correo electrónico ya está registrado.";
  }
  if (code === "auth/weak-password") {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (code === "auth/unauthorized-domain") {
    return "Este dominio no está autorizado en Firebase Authentication.";
  }
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "Cerraste la ventana antes de terminar el ingreso.";
  }
  if (code === "auth/popup-blocked") {
    return "El navegador bloqueó la ventana de Google. Intenta de nuevo o permite ventanas emergentes.";
  }
  if (code === "auth/network-request-failed") {
    return "Hay un problema de conexión con Firebase.";
  }

  return "No pudimos iniciar sesión. Intenta de nuevo en unos segundos.";
}

function isFirestoreOfflineError(error: unknown): boolean {
  const { code, message } = getErrorDetails(error);
  return code === "unavailable" || /offline|client is offline|network/i.test(message);
}

function logProfileSyncFailure(error: unknown) {
  const details = getErrorDetails(error);
  console.error("User profile sync failed", details);
}

export const authService = {
  async login(email: string, password: string): Promise<FirebaseUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      void this.ensureUserProfileSafe(userCredential.user);
      return userCredential.user;
    } catch (error) {
      console.error("Email sign-in failed", getErrorDetails(error));
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

      try {
        await setDoc(doc(db, "users", user.uid), {
          ...profile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (profileError) {
        logProfileSyncFailure(profileError);
      }

      return user;
    } catch (error) {
      console.error("Email registration failed", getErrorDetails(error));
      throw new Error(getFriendlyAuthError(error));
    }
  },

  async signInWithGoogle(): Promise<FirebaseUser | null> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    if (isMobileEnvironment()) {
      try {
        await signInWithRedirect(auth, provider);
        return null;
      } catch (error) {
        logGoogleSignInFailure(error);
        throw new Error(getFriendlyAuthError(error));
      }
    }

    try {
      const result = await signInWithPopup(auth, provider);
      void this.ensureUserProfileSafe(result.user);
      return result.user;
    } catch (error) {
      logGoogleSignInFailure(error);
      const { code } = getErrorDetails(error);
      const shouldRedirect =
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment";

      if (shouldRedirect) {
        try {
          await signInWithRedirect(auth, provider);
          return null;
        } catch (redirectError) {
          logGoogleSignInFailure(redirectError);
          throw new Error(getFriendlyAuthError(redirectError));
        }
      }

      throw new Error(getFriendlyAuthError(error));
    }
  },

  async handleGoogleRedirectResult(): Promise<FirebaseUser | null> {
    try {
      const result = await getRedirectResult(auth);
      if (!result?.user) return null;
      void this.ensureUserProfileSafe(result.user);
      return result.user;
    } catch (error) {
      logGoogleSignInFailure(error);
      throw new Error(getFriendlyAuthError(error));
    }
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

  createFallbackProfile(user: FirebaseUser): UserProfile {
    const fallbackName = user.displayName || user.email?.split("@")[0] || "Usuario";
    const savedTheme = typeof localStorage !== "undefined" ? localStorage.getItem("theme") : null;
    const theme = savedTheme === "pink" || savedTheme === "dark" ? savedTheme : undefined;

    return {
      uid: user.uid,
      name: fallbackName,
      email: user.email || "",
      photoURL: user.photoURL || null,
      role: "family",
      color: "#d7b46a",
      theme,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  },

  async ensureUserProfile(user: FirebaseUser): Promise<UserProfile> {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    const existing = docSnap.exists() ? (docSnap.data() as Partial<UserProfile>) : null;
    const fallback = this.createFallbackProfile(user);
    const profileUpdate = {
      uid: user.uid,
      name: existing?.name || fallback.name,
      email: user.email || existing?.email || "",
      photoURL: user.photoURL || existing?.photoURL || null,
      role: existing?.role || "family",
      color: existing?.color || fallback.color,
      theme: existing?.theme || fallback.theme,
      active: true,
      updatedAt: serverTimestamp(),
      ...(existing?.createdAt ? {} : { createdAt: serverTimestamp() })
    };

    await setDoc(docRef, profileUpdate, { merge: true });
    const fresh = await getDoc(docRef);
    if (fresh.exists()) {
      return fresh.data() as UserProfile;
    }

    return {
      ...fallback,
      ...profileUpdate,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  },

  async ensureUserProfileSafe(user: FirebaseUser): Promise<ProfileSyncResult> {
    const fallback = this.createFallbackProfile(user);

    try {
      const profile = await this.ensureUserProfile(user);
      return { profile, warning: null };
    } catch (error) {
      logProfileSyncFailure(error);
      return {
        profile: fallback,
        warning: isFirestoreOfflineError(error)
          ? PROFILE_SYNC_WARNING
          : "Entraste correctamente. Estamos sincronizando tus datos."
      };
    }
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
