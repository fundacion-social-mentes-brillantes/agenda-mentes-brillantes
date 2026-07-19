import { useCallback, useEffect, useState } from "react";
import { clientsService } from "../services/clientsService";
import type { Client } from "../types/client";

export function useClients(workspaceId: string | null, enabled = true) {
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId || !enabled) return;
    const unsubscribe = clientsService.subscribeToClients(
      workspaceId,
      (list) => {
        setClients(list);
        setLoadedWorkspaceId(workspaceId);
        setError(null);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar las personas.");
        setLoadedWorkspaceId(workspaceId);
      }
    );
    return () => unsubscribe();
  }, [workspaceId, enabled]);

  const createClient = useCallback(
    async (name: string): Promise<Client> => {
      if (!workspaceId) throw new Error("Selecciona una agenda.");
      return clientsService.createClient(workspaceId, name);
    },
    [workspaceId]
  );

  const importClients = useCallback(
    async (rows: { code: number; name: string; active?: boolean }[]): Promise<number> => {
      if (!workspaceId) throw new Error("Selecciona una agenda.");
      return clientsService.importClients(workspaceId, rows);
    },
    [workspaceId]
  );

  const updateClient = useCallback(
    async (
      client: { id: string; code: number; name: string; active?: boolean },
      updates: { code: number; name: string }
    ): Promise<Client> => {
      if (!workspaceId) throw new Error("Selecciona una agenda.");
      return clientsService.updateClient(workspaceId, client, updates);
    },
    [workspaceId]
  );

  const hasActiveSnapshot = enabled && !!workspaceId && loadedWorkspaceId === workspaceId;

  return {
    clients: hasActiveSnapshot ? clients : [],
    loading: enabled && !!workspaceId && !hasActiveSnapshot,
    error: hasActiveSnapshot ? error : null,
    createClient,
    importClients,
    updateClient
  };
}
