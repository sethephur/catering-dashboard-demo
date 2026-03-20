import type { Firestore } from "firebase/firestore";
import {
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  addDoc,
} from "firebase/firestore";
import { DEMO_MODE_ENABLED } from "@/config/appInfo";
import {
  createDemoEvent,
  deleteDemoEvent,
  getDemoEvents,
  nextDemoEventId,
  subscribeDemoEvents,
  updateDemoEvent,
} from "@/data/demoWorkspace";
import type { TEvent } from "../shared-types";

export type Unsub = () => void;

export const eventSortKey = (e: TEvent) => {
  const datePart = e.eventDate ?? "";
  const timePart = e.startTime ?? "00:00";
  const tryDate = new Date(`${datePart} ${timePart}`);
  const alt = Number.isNaN(tryDate.getTime()) ? new Date(datePart) : tryDate;
  return alt.getTime();
};

/**
 * Subscribe to events in the top-level `events` collection.
 * If `clientId` is provided, filters by that client.
 * Tries to order by eventDate; if the composite index is missing, falls back
 * to a simpler query without orderBy and sorts client-side.
 */
export function subscribeEvents(
  db: Firestore,
  opts: {
    clientId?: string;
    onData: (events: TEvent[]) => void;
    onError?: (err: any) => void;
  }
): Unsub {
  if (DEMO_MODE_ENABLED) {
    return subscribeDemoEvents((rows) => {
      const filtered = opts.clientId
        ? rows.filter((event) => event.clientId === opts.clientId)
        : rows;
      const sorted = [...filtered].sort((a, b) => eventSortKey(a) - eventSortKey(b));
      opts.onData(sorted);
    });
  }

  const base = collection(db, "events");

  let activeUnsub: Unsub | null = null;
  let usedFallback = false;

  const attach = (useFallback: boolean) => {
    const q = opts.clientId
      ? useFallback
        ? query(base, where("clientId", "==", opts.clientId))
        : query(
            base,
            where("clientId", "==", opts.clientId),
            orderBy("eventDate", "asc")
          )
      : useFallback
      ? query(base)
      : query(base, orderBy("eventDate", "asc"));

    return onSnapshot(
      q,
      (snap) => {
        const rows: TEvent[] = snap.docs.map((d: any) => ({
          id: d.id,
          ...d.data(),
        }));
        rows.sort((a, b) => eventSortKey(a) - eventSortKey(b));
        opts.onData(rows);
      },
      (e) => {
        if (e?.code === "failed-precondition" && !usedFallback) {
          usedFallback = true;
          if (activeUnsub) {
            activeUnsub();
            activeUnsub = null;
          }
          activeUnsub = attach(true);
          return;
        }
        opts.onError?.(e);
      }
    );
  };

  activeUnsub = attach(false);

  return () => {
    if (activeUnsub) activeUnsub();
  };
}

export async function createEvent(
  db: Firestore,
  data: Omit<TEvent, "id" | "createdAt" | "updatedAt">
) {
  if (DEMO_MODE_ENABLED) {
    const id = nextDemoEventId();
    createDemoEvent({
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return id;
  }

  const ref = collection(db, "events");
  const docRef = await addDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateEvent(
  db: Firestore,
  id: string,
  patch: Partial<Record<string, any>>
) {
  if (DEMO_MODE_ENABLED) {
    updateDemoEvent(id, (current) => ({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
    return;
  }

  const ref = doc(db, "events", id);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteEvent(db: Firestore, id: string) {
  if (DEMO_MODE_ENABLED) {
    deleteDemoEvent(id);
    return;
  }

  const ref = doc(db, "events", id);
  await deleteDoc(ref);
}
