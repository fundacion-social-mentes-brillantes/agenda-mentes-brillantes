import { useState, useEffect, useCallback } from "react";
import { eventsService } from "../services/eventsService";
import type { EventWriteResult } from "../services/eventsService";
import type { CalendarEvent } from "../types/event";

export function useEvents(workspaceId: string | null) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setEvents([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const unsubscribe = eventsService.subscribeToEvents(
      workspaceId,
      (fetchedEvents) => {
        setEvents(fetchedEvents);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Error al sincronizar los eventos.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [workspaceId]);

  const createEvent = useCallback(
    async (eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">): Promise<EventWriteResult> => {
      try {
        return await eventsService.createEvent(eventData);
      } catch (err: any) {
        console.error("Error creating event:", err);
        throw new Error(err.message || "Error al crear el evento.");
      }
    },
    []
  );

  const updateEvent = useCallback(async (eventId: string, eventData: Partial<CalendarEvent>) => {
    try {
      await eventsService.updateEvent(eventId, eventData);
    } catch (err: any) {
      console.error("Error updating event:", err);
      throw new Error(err.message || "Error al actualizar el evento.");
    }
  }, []);

  const setEventDone = useCallback(async (eventId: string, done: boolean) => {
    try {
      await eventsService.setEventDone(eventId, done);
    } catch (err: any) {
      console.error("Error updating event done:", err);
      throw new Error(err.message || "Error al actualizar el evento.");
    }
  }, []);

  const deleteEvent = useCallback(async (eventId: string) => {
    try {
      await eventsService.deleteEvent(eventId);
    } catch (err: any) {
      console.error("Error deleting event:", err);
      throw new Error(err.message || "Error al eliminar el evento.");
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
