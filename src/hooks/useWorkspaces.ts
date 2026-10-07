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
  const uid = user?.uid ?? null;

  // Lo que llego del servidor y lo que eligio la persona, cada cosa con el
  // usuario al que pertenece. Lo que se muestra se deriva de ahi: los efectos
  // solo escuchan a Firebase y no copian estados (y al cambiar de cuenta nunca
  // se alcanzan a ver las agendas de la anterior).
  const [delServidor, setDelServidor] = useState<{ uid: string; lista: WorkspaceWithRole[]; error: string | null } | null>(null);
  const [elegida, setElegida] = useState<{ uid: string; id: string } | null>(null);
  const [errorPersonal, setErrorPersonal] = useState<{ uid: string; mensaje: string } | null>(null);

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
        if (!cancelled) {
          setErrorPersonal({
            uid: user.uid,
            mensaje: "No pudimos preparar tu agenda personal. Revisa que se publicaron las reglas de Firebase y recarga."
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Escucha en tiempo real las agendas del usuario.
  useEffect(() => {
    if (!user) return;
    const dueno = user.uid;
    const unsubscribe = workspaceService.subscribeToMyWorkspaces(
      dueno,
      (list) => {
        guardarCache(dueno, list); // para el próximo arranque
        setDelServidor({ uid: dueno, lista: list, error: null });
      },
      (err) =>
        setDelServidor((previo) => ({
          uid: dueno,
          lista: previo?.uid === dueno ? previo.lista : leerCache(dueno),
          error: err instanceof Error ? err.message : "No pudimos cargar tus agendas."
        }))
    );

    return () => unsubscribe();
  }, [user]);

  // Arranque rápido: mientras llega la lista real se muestran las agendas que ya
  // conocíamos de la última vez. Sin copia guardada (primera vez), se espera.
  const enCache = useMemo(() => (uid ? leerCache(uid) : []), [uid]);
  const vigente = delServidor && delServidor.uid === uid ? delServidor : null;
  const workspaces = useMemo(() => (!uid ? [] : vigente ? vigente.lista : enCache), [uid, vigente, enCache]);
  const loading = Boolean(uid) && !vigente && enCache.length === 0;
  const error = vigente?.error ?? (errorPersonal && errorPersonal.uid === uid ? errorPersonal.mensaje : null);

  // Activa: la que eligió (en esta sesión o la vez pasada) si sigue existiendo;
  // si no, la personal; si no, la primera.
  const activeWorkspaceId = useMemo(() => {
    if (!uid) return null;
    const guardada = typeof localStorage !== "undefined" ? localStorage.getItem(activeStorageKey(uid)) : null;
    const candidata = (elegida?.uid === uid ? elegida.id : null) || guardada;
    if (candidata && workspaces.some((ws) => ws.id === candidata)) return candidata;
    const personal = workspaces.find((ws) => ws.id === personalWorkspaceId(uid));
    return personal?.id || workspaces[0]?.id || null;
  }, [uid, elegida, workspaces]);

  const setActiveWorkspaceId = useCallback(
    (id: string) => {
      if (!user) return;
      setElegida({ uid: user.uid, id });
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(activeStorageKey(user.uid), id);
        } catch {
          /* sin almacenamiento: la elección vale solo en esta sesión */
        }
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
