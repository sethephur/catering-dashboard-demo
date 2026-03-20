import type { Firestore } from "firebase/firestore";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { DEMO_MODE_ENABLED } from "@/config/appInfo";
import {
  appendDemoHelpMessage,
  createDemoHelpTicket,
  nextDemoReplyId,
  nextDemoTicketId,
  subscribeDemoHelpMessages,
  subscribeDemoHelpTickets,
  updateDemoHelpTicket,
} from "@/data/demoWorkspace";
import {
  helpTicketMessageSchema,
  helpTicketSchema,
  type HelpTicket,
  type HelpTicketMessage,
  type HelpTicketStatus,
} from "@/shared-types";

const HELP_TICKET_COLLECTION = "helpTickets";

const parseHelpTicket = (
  id: string,
  data: Record<string, unknown>,
): HelpTicket => helpTicketSchema.parse({ id, ...data });

const parseHelpTicketMessage = (
  id: string,
  data: Record<string, unknown>,
): HelpTicketMessage => helpTicketMessageSchema.parse({ id, ...data });

export function subscribeHelpTickets(
  db: Firestore,
  opts: {
    onData: (tickets: HelpTicket[]) => void;
    onError?: (error: unknown) => void;
  },
) {
  if (DEMO_MODE_ENABLED) {
    return subscribeDemoHelpTickets(opts.onData);
  }

  const q = query(
    collection(db, HELP_TICKET_COLLECTION),
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      opts.onData(
        snapshot.docs.map((item) =>
          parseHelpTicket(item.id, item.data() as Record<string, unknown>),
        ),
      );
    },
    opts.onError,
  );
}

export function subscribeHelpTicketMessages(
  db: Firestore,
  ticketId: string,
  opts: {
    onData: (messages: HelpTicketMessage[]) => void;
    onError?: (error: unknown) => void;
  },
) {
  if (DEMO_MODE_ENABLED) {
    return subscribeDemoHelpMessages(ticketId, opts.onData);
  }

  const q = query(
    collection(db, HELP_TICKET_COLLECTION, ticketId, "messages"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      opts.onData(
        snapshot.docs.map((item) =>
          parseHelpTicketMessage(item.id, item.data() as Record<string, unknown>),
        ),
      );
    },
    opts.onError,
  );
}

export async function updateHelpTicketStatus(opts: {
  db: Firestore;
  ticketId: string;
  status: HelpTicketStatus;
}) {
  if (DEMO_MODE_ENABLED) {
    updateDemoHelpTicket(opts.ticketId, (ticket) => ({
      ...ticket,
      status: opts.status,
      updatedAt: new Date().toISOString(),
      lastMessageAt: ticket.lastMessageAt ?? ticket.updatedAt,
    }));
    return;
  }

  await updateDoc(doc(opts.db, HELP_TICKET_COLLECTION, opts.ticketId), {
    status: opts.status,
    updatedAt: serverTimestamp(),
  });
}

export async function addSupportReply(opts: {
  db: Firestore;
  ticketId: string;
  body: string;
  authorName?: string | null;
  status?: HelpTicketStatus;
}) {
  const trimmedBody = opts.body.trim();
  if (!trimmedBody) {
    throw new Error("Reply body is required.");
  }

  if (DEMO_MODE_ENABLED) {
    appendDemoHelpMessage(opts.ticketId, {
      id: nextDemoReplyId(opts.ticketId),
      authorType: "support",
      authorName: opts.authorName?.trim() || "Support",
      body: trimmedBody,
      createdAt: new Date().toISOString(),
    });
    updateDemoHelpTicket(opts.ticketId, (ticket) => ({
      ...ticket,
      status: opts.status ?? "pending_requester",
      lastMessagePreview: trimmedBody.slice(0, 180),
      lastMessageAt: new Date().toISOString(),
      lastResponderType: "support",
      updatedAt: new Date().toISOString(),
    }));
    return;
  }

  const ticketRef = doc(opts.db, HELP_TICKET_COLLECTION, opts.ticketId);
  const messageRef = doc(
    collection(opts.db, HELP_TICKET_COLLECTION, opts.ticketId, "messages"),
  );

  const batch = writeBatch(opts.db);
  batch.set(messageRef, {
    authorType: "support",
    authorName: opts.authorName?.trim() || "Support",
    body: trimmedBody,
    createdAt: serverTimestamp(),
  });
  batch.update(ticketRef, {
    status: opts.status ?? "pending_requester",
    lastMessagePreview: trimmedBody.slice(0, 180),
    lastMessageAt: serverTimestamp(),
    lastResponderType: "support",
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function createHelpTicket(opts: {
  db: Firestore;
  name: string;
  email: string;
  category: string;
  locationHint: string;
  message: string;
}) {
  const trimmedMessage = opts.message.trim();
  if (!trimmedMessage) {
    throw new Error("Message is required.");
  }

  if (DEMO_MODE_ENABLED) {
    createDemoHelpTicket(
      helpTicketSchema.parse({
        id: nextDemoTicketId(),
        name: opts.name.trim() || null,
        email: opts.email.trim() || null,
        category: opts.category.trim() || null,
        locationHint: opts.locationHint.trim() || null,
        message: trimmedMessage,
        status: "open",
        source: "dashboard-help-page",
        lastMessagePreview: trimmedMessage.slice(0, 180),
        lastResponderType: "requester",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
      }),
    );
    return;
  }

  await addDoc(collection(opts.db, HELP_TICKET_COLLECTION), {
    name: opts.name.trim() || null,
    email: opts.email.trim() || null,
    category: opts.category.trim() || null,
    locationHint: opts.locationHint.trim() || null,
    message: trimmedMessage,
    status: "open",
    source: "dashboard-help-page",
    lastMessagePreview: trimmedMessage.slice(0, 180),
    lastResponderType: "requester",
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
