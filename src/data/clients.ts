import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  DocumentData,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { DEMO_MODE_ENABLED } from "@/config/appInfo";
import {
  createDemoClient,
  deleteDemoClient,
  getDemoClients,
  nextDemoClientId,
  subscribeDemoClients,
  updateDemoClient,
} from "@/data/demoWorkspace";
import { database } from "../utils/firebaseConfig";
import type { Client } from "../shared-types";

// ——— Helpers ———
function snapToClient(doc: QueryDocumentSnapshot<DocumentData>): Client {
  const d = doc.data() || {};
  return {
    id: doc.id,
    firstName: (d.firstName ?? "").toString(),
    lastName: (d.lastName ?? "").toString(),
    company: (d.company ?? "").toString(),
    email: (d.email ?? "").toString(),
    phone: (d.phone ?? "").toString(),
    phoneNormalized: d.phoneNormalized ? String(d.phoneNormalized) : undefined,
    events: Array.isArray(d.events) ? (d.events as number[]) : null,
    emails: Array.isArray(d.emails) ? (d.emails as string[]) : [],
    emailsNormalized: Array.isArray(d.emailsNormalized)
      ? (d.emailsNormalized as string[])
      : [],
    inquiryIds: Array.isArray(d.inquiryIds) ? (d.inquiryIds as string[]) : [],
    lastInquiryAt: d.lastInquiryAt ? String(d.lastInquiryAt) : undefined,
    createdAt: d.createdAt ?? null,
    updatedAt: d.updatedAt ?? null,
  };
}

function clientsQuery() {
  // Use a single orderBy to avoid composite index requirements during dev.
  // If you want secondary ordering by firstName, create a composite index and re-add the second orderBy.
  return query(collection(database, "clientProfiles"), orderBy("lastName", "asc"));
}

// ——— One-shot fetch ———
export async function fetchClients(): Promise<Client[]> {
  if (DEMO_MODE_ENABLED) {
    return getDemoClients();
  }
  const qs = await getDocs(clientsQuery());
  return qs.docs.map(snapToClient);
}

// ——— Realtime subscription ———
export function subscribeClients(
  handler: (clients: Client[]) => void,
  onError?: (err: unknown) => void
) {
  if (DEMO_MODE_ENABLED) {
    return subscribeDemoClients(handler);
  }

  return onSnapshot(
    clientsQuery(),
    (qs) => {
      const mapped = qs.docs.map(snapToClient);
      console.debug("[useClients] snapshot size:", qs.size, { sample: mapped[0] });
      handler(mapped);
    },
    (err) => {
      console.error("[useClients] onSnapshot error:", err);
      onError?.(err);
    }
  );
}

export async function createClientProfile(
  payload: Omit<Client, "id">,
): Promise<string> {
  if (DEMO_MODE_ENABLED) {
    const id = nextDemoClientId();
    createDemoClient({
      ...payload,
      id,
      createdAt: payload.createdAt ?? new Date().toISOString(),
      updatedAt: payload.updatedAt ?? new Date().toISOString(),
    });
    return id;
  }

  const ref = doc(collection(database, "clientProfiles"));
  await setDoc(ref, {
    ...payload,
    createdAt: payload.createdAt ?? serverTimestamp(),
    updatedAt: payload.updatedAt ?? serverTimestamp(),
  });
  return ref.id;
}

export async function updateClientProfile(
  id: string,
  patch: Partial<Client>,
): Promise<void> {
  if (DEMO_MODE_ENABLED) {
    updateDemoClient(id, (current) => ({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
    return;
  }

  const ref = doc(database, "clientProfiles", id);
  await updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClientProfile(id: string): Promise<void> {
  if (DEMO_MODE_ENABLED) {
    deleteDemoClient(id);
    return;
  }

  await deleteDoc(doc(database, "clientProfiles", id));
}

// ——— React hook (realtime) ———
export function useClients() {
  const [data, setData] = useState<Client[] | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    console.debug("[useClients] mount");
    const unsub = subscribeClients(
      (clients) => {
        setData(clients);
        setError(null);
      },
      (err) => setError(err)
    );
    return () => unsub();
  }, []);

  const isLoading = useMemo(() => data === undefined && !error, [data, error]);

  return {
    data: data ?? [],
    isLoading,
    error,
  };
}
