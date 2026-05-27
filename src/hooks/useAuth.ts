import React, { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { auth } from "../lib/firebase";
import { authService } from "../services/authService";
import type { UserProfile } from "../types/user";

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  error: null,
  refreshProfile: async () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (uid: string) => {
    try {
      const userProfile = await authService.getUserProfile(uid);
      if (userProfile) {
        setProfile(userProfile);
      } else {
        if (auth.currentUser) {
          const fresh = await authService.ensureUserProfile(auth.currentUser);
          setProfile(fresh);
        }
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setError("Error al cargar perfil de usuario");
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  useEffect(() => {
    authService.handleGoogleRedirectResult().catch((err) => {
      console.error("Error handling Google redirect:", err);
      setError("No pudimos completar el ingreso con Google.");
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setError(null);
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Use React.createElement to avoid JSX in a .ts file
  return React.createElement(
    AuthContext.Provider,
    { value: { user, profile, loading, error, refreshProfile } },
    children
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
