import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { z } from "zod";
import { DEMO_MODE_ENABLED } from "@/config/appInfo";
import { DEMO_INQUIRIES } from "@/data/demoInquiries";
import { inquirySchema, type Inquiry } from "@/shared-types";
import { database } from "../utils/firebaseConfig";

const inquiriesCollection = collection(database, "eventInquiries");

const parseInquiryDoc = (
  doc: QueryDocumentSnapshot<DocumentData>,
): Inquiry => inquirySchema.parse({ docId: doc.id, ...doc.data() });

const inquiriesLiveQuery = query(inquiriesCollection, orderBy("createdAt", "desc"));

const demoInquiries = [...DEMO_INQUIRIES];

export type InquiryCursor = QueryDocumentSnapshot<DocumentData> | number | null;

const getDemoInquiryPage = ({
  pageSize,
  cursor = null,
}: {
  pageSize: number;
  cursor?: InquiryCursor;
}) => {
  const startIndex = typeof cursor === "number" && cursor >= 0 ? cursor : 0;
  const items = demoInquiries.slice(startIndex, startIndex + pageSize);
  const nextIndex = startIndex + items.length;

  return {
    items,
    lastVisible: nextIndex >= demoInquiries.length ? null : nextIndex,
  };
};

export const getInquiries = async (): Promise<Inquiry[]> => {
  if (DEMO_MODE_ENABLED) {
    return demoInquiries;
  }
  const snapshot = await getDocs(inquiriesLiveQuery);
  return z.array(inquirySchema).parse(snapshot.docs.map((doc) => ({ docId: doc.id, ...doc.data() })));
};

export const subscribeInquiries = (
  onData: (inquiries: Inquiry[]) => void,
  onError?: (error: unknown) => void,
) => {
  if (DEMO_MODE_ENABLED) {
    onData(demoInquiries);
    return () => undefined;
  }

  return onSnapshot(
    inquiriesLiveQuery,
    (snapshot) => {
      onData(snapshot.docs.map(parseInquiryDoc));
    },
    onError,
  );
};

export const getInquiryCount = async (): Promise<number> => {
  if (DEMO_MODE_ENABLED) {
    return demoInquiries.length;
  }
  const snapshot = await getCountFromServer(inquiriesCollection);
  return snapshot.data().count;
};

export type InquiryPage = {
  items: Inquiry[];
  lastVisible: InquiryCursor;
};

export const getInquiryPage = async ({
  pageSize,
  cursor = null,
}: {
  pageSize: number;
  cursor?: InquiryCursor;
}): Promise<InquiryPage> => {
  if (DEMO_MODE_ENABLED) {
    return getDemoInquiryPage({ pageSize, cursor });
  }

  const q = cursor
    ? query(
        inquiriesCollection,
        orderBy("createdAt", "desc"),
        startAfter(cursor),
        limit(pageSize),
      )
    : query(inquiriesCollection, orderBy("createdAt", "desc"), limit(pageSize));

  const snapshot = await getDocs(q);

  return {
    items: snapshot.docs.map(parseInquiryDoc),
    lastVisible: snapshot.docs.at(-1) ?? null,
  };
};
