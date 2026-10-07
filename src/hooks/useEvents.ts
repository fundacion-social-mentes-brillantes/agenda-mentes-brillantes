import { useState, useEffect, useCallback } from "react";
import { eventsService } from "../services/eventsService";
import type { EventWriteResult } from "../services/eventsService";
import type { CalendarEvent } from "../types/event";

/** Mensaje del error, o el de respaldo si no trae uno legible. */
function mensajeDe(err: unknown, respaldo: string): string {
  return err instanceof Error && err.message ? err.message : respaldo;
}

export function useEvents(workspaceIds: string[]) {
  // Clave estable para no re-suscribir por identidad del array.
  const idsKey = [...new Set((workspaceIds || []).filter(Boolean))].sort().join(",");

  // Lo ultimo que llego, con la clave de agendas a la que pertenece. "Cargando"
  // es simplemente que todavia no llega nada para la clave actual: asi el efecto
  // no tiene que poner estados a mano (y mientras carga se siguen viendo los
  // eventos anteriores, como antes).
  const [datos, setDatos] = useState<{ clave: string; events: CalendarEvent[]; error: string | null }>({
    clave: "",
    events: [],
    error: null
  });

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) return;

    const unsubscribe = eventsService.subscribeToEventsMulti(
      ids,
      (fetchedEvents) => setDatos({ clave: idsKey, events: fetchedEvents, error: null }),
      (err) =>
        setDatos((previo) => ({
          clave: idsKey,
          events: previo.events,
          error: mensajeDe(err, "Error al sincronizar los eventos.")
        }))
    );

    return () => unsubscribe();
  }, [idsKey]);

  const vigente = datos.clave === idsKey;
  const events = idsKey ? datos.events : [];
  const loading = Boolean(idsKey) && !vigente;
  const error = idsKey && vigente ? datos.error : null;

  const createEvent = useCallback(
    async (eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">): Promise<EventWriteResult> => {
      try {
        return await eventsService.createEvent(eventData);
      } catch (err) {
        console.error("Error creating event:", err);
        throw new Error(mensajeDe(err, "Error al crear el evento."), { cause: err });
      }
    },
    []
  );

  const updateEvent = useCallback(async (eventId: string, eventData: Partial<CalendarEvent>) => {
    try {
      await eventsService.updateEvent(eventId, eventData);
    } catch (err) {
      console.error("Error updating event:", err);
      throw new Error(mensajeDe(err, "Error al actualizar el evento."), { cause: err });
    }
  }, []);

  const setEventDone = useCallback(async (eventId: string, done: boolean) => {
    try {
      await eventsService.setEventDone(eventId, done);
    } catch (err) {
      console.error("Error updating event done:", err);
      throw new Error(mensajeDe(err, "Error al actualizar el evento."), { cause: err });
    }
  }, []);

  const deleteEvent = useCallback(async (eventId: string) => {
    try {
      await eventsService.deleteEvent(eventId);
    } catch (err) {
      console.error("Error deleting event:", err);
      throw new Error(mensajeDe(err, "Error al eliminar el evento."), { cause: err });
    }
  }, []);

  return {
    events,
    loading,
    error,
    createEvent,
    updateEvent,
    setEventDone,
    deleteEvent
  };
}
