import {
  collection,
  getDocs,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { DEMO_MODE_ENABLED } from "@/config/appInfo";
import { DEMO_INQUIRIES } from "@/data/demoInquiries";
import { getDemoClients, getDemoEvents } from "@/data/demoWorkspace";
import { database } from "@/utils/firebaseConfig";
import {
  clientSchema,
  eventSchema,
  inquirySchema,
  type Client,
  type Inquiry,
  type TEvent,
} from "@/shared-types";

export type ReportsSourceData = {
  inquiries: Inquiry[];
  events: TEvent[];
  clients: Client[];
};

type SnapshotParser<T> = (snapshot: QueryDocumentSnapshot<DocumentData>) => T | null;

const collectValidDocs = <T>(
  label: string,
  snapshots: QueryDocumentSnapshot<DocumentData>[],
  parser: SnapshotParser<T>,
): T[] => {
  const results: T[] = [];

  snapshots.forEach((snapshot) => {
    const parsed = parser(snapshot);
    if (parsed) {
      results.push(parsed);
      return;
    }

    console.warn(`[reports] Skipping invalid ${label} document`, snapshot.id);
  });

  return results;
};

const parseInquiry = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
): Inquiry | null => {
  const parsed = inquirySchema.safeParse({
    docId: snapshot.id,
    ...snapshot.data(),
  });
  return parsed.success ? parsed.data : null;
};

const parseEvent = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
): TEvent | null => {
  const parsed = eventSchema.safeParse({
    id: snapshot.id,
    ...snapshot.data(),
  });
  return parsed.success ? parsed.data : null;
};

const parseClient = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
): Client | null => {
  const parsed = clientSchema.safeParse({
    id: snapshot.id,
    ...snapshot.data(),
  });
  return parsed.success ? parsed.data : null;
};

export async function fetchReportsSourceData(): Promise<ReportsSourceData> {
  if (DEMO_MODE_ENABLED) {
    return {
      inquiries: DEMO_INQUIRIES,
      events: getDemoEvents(),
      clients: getDemoClients(),
    };
  }

  const [inquiriesSnapshot, eventsSnapshot, clientsSnapshot] = await Promise.all([
    getDocs(collection(database, "eventInquiries")),
    getDocs(collection(database, "events")),
    getDocs(collection(database, "clientProfiles")),
  ]);

  return {
    inquiries: collectValidDocs(
      "inquiry",
      inquiriesSnapshot.docs,
      parseInquiry,
    ),
    events: collectValidDocs("event", eventsSnapshot.docs, parseEvent),
    clients: collectValidDocs("client", clientsSnapshot.docs, parseClient),
  };
}
