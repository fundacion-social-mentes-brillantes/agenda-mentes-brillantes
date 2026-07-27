import { useCallback, useEffect, useMemo, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { eventsService } from "../services/eventsService";
import { personalWorkspaceId, workspaceService } from "../services/workspaceService";
import type { WorkspaceWithRole } from "../types/workspace";

function activeStorageKey(uid: string) {
  return `activeWorkspace_${uid}`;
}

function cacheKey(uid: string) {
  return `workspacesCache_${uid}`;
}

/**
 * Guarda/lee la lista de agendas en el propio dispositivo.
 *
 * Antes, al abrir la app había que ESPERAR a que el servidor respondiera con las
 * agendas para recién entonces poder pedir los eventos: dos esperas en fila. Con
 * esta copia local, la agenda se muestra al instante y la lista real llega por
 * detrás y la corrige si algo cambió.
 */
function leerCache(uid: string): WorkspaceWithRole[] {
  try {
    const crudo = localStorage.getItem(cacheKey(uid));
    if (!crudo) return [];
    const lista = JSON.parse(crudo);
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((ws) => ws && typeof ws.id === "string" && typeof ws.name === "string")
      .map((ws) => ({
        ...ws,
        // Las fechas se guardan como texto; se devuelven como fecha real.
        createdAt: ws.createdAt ? new Date(ws.createdAt) : new Date(0),
        updatedAt: ws.updatedAt ? new Date(ws.updatedAt) : new Date(0)
      })) as WorkspaceWithRole[];
  } catch {
    return [];
  }
}

function guardarCache(uid: string, lista: WorkspaceWithRole[]) {
  try {
    const plano = lista.map((ws) => ({
      ...ws,
      createdAt: toIso(ws.createdAt),
      updatedAt: toIso(ws.updatedAt)
    }));
    localStorage.setItem(cacheKey(uid), JSON.stringify(plano));
  } catch {
    /* sin almacenamiento: no pasa nada, solo se pierde el arranque rápido */
  }
}

function toIso(valor: unknown): string {
  try {
    if (valor instanceof Date) return valor.toISOString();
    const conToDate = valor as { toDate?: () => Date } | null;
    if (conToDate && typeof conToDate.toDate === "function") return conToDate.toDate().toISOString();
  } catch {
    /* fecha rara: se ignora */
  }
  return new Date(0).toISOString();
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

    // Arranque rápido: se muestran de inmediato las agendas que ya conocíamos de la
    // última vez, sin esperar al servidor. Si no hay copia guardada (primera vez),
    // se comporta como antes y muestra el indicador de carga.
    const guardadas = leerCache(user.uid);
    if (guardadas.length > 0) {
      setWorkspaces(guardadas);
      setLoading(false);
      // También se recupera cuál estaba activa, para que nada quede vacío mientras llega
      // la lista real del servidor.
      setActiveWorkspaceIdState((current) => {
        const stored = typeof localStorage !== "undefined" ? localStorage.getItem(activeStorageKey(user.uid)) : null;
        const candidate = current || stored;
        if (candidate && guardadas.some((ws) => ws.id === candidate)) return candidate;
        const personal = guardadas.find((ws) => ws.id === personalWorkspaceId(user.uid));
        return personal?.id || guardadas[0]?.id || null;
      });
    } else {
      setLoading(true);
    }

    const unsubscribe = workspaceService.subscribeToMyWorkspaces(
      user.uid,
      (list) => {
        setWorkspaces(list);
        guardarCache(user.uid, list); // para el próximo arranque
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
