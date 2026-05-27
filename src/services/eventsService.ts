import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  Timestamp 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { CalendarEvent, EventStatus } from "../types/event";
import { getEventMeta } from "../lib/eventMeta";

export const eventsService = {
  // Subscribe to all events in real-time
  subscribeToEvents(onUpdate: (events: CalendarEvent[]) => void, onError?: (error: any) => void) {
    const q = query(
      collection(db, "events"),
      orderBy("startAt", "asc")
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const events: CalendarEvent[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const type = data.type || "other";
          const meta = getEventMeta(type);
          return {
            id: docSnap.id,
            ...data,
            type,
            status: data.status || "scheduled",
            priority: data.priority || "medium",
            color: data.color || meta.color,
            description: data.description || "",
            participants: data.participants || data.clientName || "",
            reminderMinutes: data.reminderMinutes ?? null,
            imageUrl: data.imageUrl || null,
            imagePath: data.imagePath || null,
            // Convert Firestore timestamps to standard dates for consistency in the UI
            startAt: data.startAt instanceof Timestamp ? data.startAt.toDate() : new Date(data.startAt),
            endAt: data.endAt instanceof Timestamp ? data.endAt.toDate() : new Date(data.endAt),
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)
          } as CalendarEvent;
        });
        onUpdate(events);
      },
      (error) => {
        console.error("Error subscribing to events: ", error);
        if (onError) onError(error);
      }
    );
  },

  // Create a new event
  async createEvent(eventData: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const docRef = await addDoc(collection(db, "events"), {
      ...eventData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  // Update an existing event
  async updateEvent(eventId: string, eventData: Partial<CalendarEvent>): Promise<void> {
    // Avoid overwriting fields with bad objects
    const cleanData: any = { ...eventData };
    delete cleanData.id;
    
    cleanData.updatedAt = serverTimestamp();
    
    const docRef = doc(db, "events", eventId);
    await updateDoc(docRef, cleanData);
  },

  // Update event status only (quick action)
  async updateEventStatus(eventId: string, status: EventStatus): Promise<void> {
    const docRef = doc(db, "events", eventId);
    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp()
    });
  },

  // Delete an event
  async deleteEvent(eventId: string): Promise<void> {
    const docRef = doc(db, "events", eventId);
    await deleteDoc(docRef);
  }
};
