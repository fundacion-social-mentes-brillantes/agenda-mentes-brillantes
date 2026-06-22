import { useCallback, useEffect, useMemo, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { eventsService } from "../services/eventsService";
import { personalWorkspaceId, workspaceService } from "../services/workspaceService";
import type { WorkspaceWithRole } from "../types/workspace";

function activeStorageKey(uid: string) {
  return `activeWorkspace_${uid}`;
}

export function useWorkspaces(user: FirebaseUser | null) {
  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Asegura agenda personal + migra eventos antiguos (una sola vez por usuario).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const personal = await workspaceService.ensurePersonalWorkspace(user);
        if (cancelled) return;

        const migrationKey = `migrated_${user.uid}`;
        if (typeof localStorage !== "undefined" && !localStorage.getItem(migrationKey)) {
          try {
            await eventsService.migrateLegacyEvents(user.uid, personal.id);
            localStorage.setItem(migrationKey, "1");
          } catch (migrationError) {
            // No marcamos la bandera: se reintentará en el próximo arranque.
            console.warn("Migración de eventos antiguos pendiente, se reintentará luego", migrationError);
          }
        }
      } catch (err) {
        console.error("No se pudo preparar la agenda personal", err);
        if (!cancelled) setError("No pudimos preparar tu agenda personal. Revisa que se publicaron las reglas de Firebase y recarga.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Escucha en tiempo real las agendas del usuario.
  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      setActiveWorkspaceIdState(null);
      return;
    }

    setLoading(true);
    const unsubscribe = workspaceService.subscribeToMyWorkspaces(
      user.uid,
      (list) => {
        setWorkspaces(list);
        setLoading(false);
        setError(null);

        setActiveWorkspaceIdState((current) => {
          const stored = typeof localStorage !== "undefined" ? localStorage.getItem(activeStorageKey(user.uid)) : null;
          const candidate = current || stored;
          if (candidate && list.some((ws) => ws.id === candidate)) {
            return candidate;
          }
          const personal = list.find((ws) => ws.id === personalWorkspaceId(user.uid));
          return personal?.id || list[0]?.id || null;
        });
      },
      (err) => {
        setError(err instanceof Error ? err.message : "No pudimos cargar tus agendas.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const setActiveWorkspaceId = useCallback(
    (id: string) => {
      setActiveWorkspaceIdState(id);
      if (user && typeof localStorage !== "undefined") {
        localStorage.setItem(activeStorageKey(user.uid), id);
      }
    },
    [user]
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === activeWorkspaceId) || null,
    [workspaces, activeWorkspaceId]
  );

  return {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspaceId,
    loading,
    error
  };
}
