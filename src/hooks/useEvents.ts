import { createEvent, deleteEvent, subscribeEvents, updateEvent } from "@/data/events";
import { TEvent } from "@/shared-types";
import { Firestore, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";

export type NewEventPayload = {
  clientId: string;
  eventDate: string;
  eventName?: string | null;
  startTime?: string;
  endTime?: string;
  siteAddress?: string;
  siteContact?: string;
  plannedGuestCount?: string;
  notes?: string;
  eventStatus?: string; // optional; default handled in create()
};

const parseErr = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useEvents(db: Firestore) {
  const [events, setEvents] = useState<TEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeEvents(db, {
      onData: (rows) => {
        setEvents(rows);
        setLoading(false);
      },
      onError: (e) => {
        setError(parseErr(e));
        setLoading(false);
      },
    });
    return () => unsub();
  }, [db]);

  const create = async (payload: NewEventPayload) => {
    // Minimal required fields are clientId and eventDate; defaults handled here
    await createEvent(db, {
      ...payload,
      eventStatus: payload.eventStatus ?? "unprocessed",
    });
  };

  const update = async (id: string, updates: Partial<TEvent>) =>
    updateEvent(db as Firestore, id, { ...updates, updatedAt: serverTimestamp() } as Partial<TEvent>);

  const remove = async (id: string) => deleteEvent(db as Firestore, id);

  return { events, loading, error, create, update, remove };
}
