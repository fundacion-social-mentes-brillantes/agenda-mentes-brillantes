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
  profileSyncWarning: string | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  error: null,
  profileSyncWarning: null,
  refreshProfile: async () => {}
});

let redirectResultHandled = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [profileSyncWarning, setProfileSyncWarning] = useState<string | null>(null);

  const syncProfile = async (firebaseUser: FirebaseUser) => {
    const result = await authService.ensureUserProfileSafe(firebaseUser);
    if (auth.currentUser?.uid !== firebaseUser.uid) return;

    setProfile(result.profile);
    setProfileSyncWarning(result.warning);
  };

  const refreshProfile = async () => {
    if (!auth.currentUser) return;
    await syncProfile(auth.currentUser);
  };

  useEffect(() => {
    if (!redirectResultHandled) {
      redirectResultHandled = true;
      authService.handleGoogleRedirectResult().catch((err) => {
        console.error("Error handling Google redirect:", err);
        setError(err instanceof Error ? err.message : "No pudimos completar el ingreso con Google.");
      });
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setError(null);
      setUser(firebaseUser);

      if (firebaseUser) {
        setProfile(authService.createFallbackProfile(firebaseUser));
        setProfileSyncWarning(null);
        setLoading(false);
        void syncProfile(firebaseUser);
        return;
      }

      setProfile(null);
      setProfileSyncWarning(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return React.createElement(
    AuthContext.Provider,
    { value: { user, profile, loading, error, profileSyncWarning, refreshProfile } },
    children
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
