import { useState, useEffect, useCallback } from "react";
import { eventsService } from "../services/eventsService";
import type { CalendarEvent, EventStatus } from "../types/event";

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = eventsService.subscribeToEvents(
      (fetchedEvents) => {
        setEvents(fetchedEvents);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message || "Error al sincronizar los eventos.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const createEvent = useCallback(async (eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">) => {
    try {
      return await eventsService.createEvent(eventData);
    } catch (err: any) {
      console.error("Error creating event:", err);
      throw new Error(err.message || "Error al crear el evento.");
    }
  }, []);

  const updateEvent = useCallback(async (eventId: string, eventData: Partial<CalendarEvent>) => {
    try {
      await eventsService.updateEvent(eventId, eventData);
    } catch (err: any) {
      console.error("Error updating event:", err);
      throw new Error(err.message || "Error al actualizar el evento.");
    }
  }, []);

  const updateEventStatus = useCallback(async (eventId: string, status: EventStatus) => {
    try {
      await eventsService.updateEventStatus(eventId, status);
    } catch (err: any) {
      console.error("Error updating event status:", err);
      throw new Error(err.message || "Error al actualizar el estado del evento.");
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
    updateEventStatus,
    deleteEvent
  };
}
