import { useCallback, useEffect, useState } from "react";
import { clientsService } from "../services/clientsService";
import type { Client } from "../types/client";

export function useClients(workspaceId: string | null) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setClients([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const unsubscribe = clientsService.subscribeToClients(
      workspaceId,
      (list) => {
        setClients(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar las personas.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [workspaceId]);

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

  return { clients, loading, error, createClient, importClients, updateClient };
}
