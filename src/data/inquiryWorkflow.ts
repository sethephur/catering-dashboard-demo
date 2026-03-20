import {
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { Client, Inquiry } from "@/shared-types";
import { fetchClients } from "@/data/clients";
import normalizePhoneE164 from "@/utils/phoneUtils";

export type EventDraft = {
  clientId?: string | null;
  eventName?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  siteAddress?: string | null;
  siteContact?: string | null;
  plannedGuestCount?: string | null;
  notes?: string | null;
  eventStatus?: string | null;
};

export type InquiryMatchResult =
  | {
      status: "linked";
      client: Client;
      candidates: Client[];
      emailNormalized: string | null;
      phoneNormalized: string | null;
    }
  | {
      status: "ambiguous_match" | "no_match";
      client: null;
      candidates: Client[];
      emailNormalized: string | null;
      phoneNormalized: string | null;
    };

export type ConvertInquiryToEventResult = {
  eventId: string;
  clientId: string;
  createdClient: boolean;
};

export type ReconcileInquiryLinksResult = {
  changedCount: number;
};

export type LinkInquiryToClientResult = {
  inquiry: Inquiry;
  clientId: string;
};

const normalizeEmail = (value: unknown) => {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const normalizePhone = (value: unknown) =>
  typeof value === "string" || typeof value === "number"
    ? normalizePhoneE164(String(value))
    : null;

const toMillis = (value: unknown): number => {
  try {
    if (!value) return 0;
    if (
      typeof value === "object" &&
      value != null &&
      "toDate" in value &&
      typeof (value as { toDate?: () => Date }).toDate === "function"
    ) {
      return (value as { toDate: () => Date }).toDate().getTime();
    }
    if (typeof value === "object" && value != null && "seconds" in value) {
      const seconds = (value as { seconds?: unknown }).seconds;
      if (typeof seconds === "number") return seconds * 1000;
    }
    if (typeof value === "string") {
      const direct = Date.parse(value);
      if (!Number.isNaN(direct)) return direct;
      const normalized = value
        .replace(/\sat\s/i, " ")
        .replace(/\u202F/g, " ")
        .replace(/UTC/g, "GMT");
      const fallback = Date.parse(normalized);
      if (!Number.isNaN(fallback)) return fallback;
    }
  } catch {
    return 0;
  }
  return 0;
};

const toIsoDateTime = (value: unknown) => {
  const ms = toMillis(value);
  return ms > 0 ? new Date(ms).toISOString() : undefined;
};

const nonEmptyString = (value: unknown) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const getInquiryDocId = (inquiry: Inquiry) => {
  const candidates = [inquiry.docId, inquiry.id];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  return "";
};

const getClientDisplayName = (client: Pick<Client, "firstName" | "lastName" | "company" | "email">) =>
  [client.firstName, client.lastName].filter(Boolean).join(" ").trim() ||
  client.company ||
  client.email ||
  "Unknown client";

const getClientIdentity = (client: Client) => {
  const emailNormalized = normalizeEmail(client.email);
  const phoneNormalized =
    normalizePhone(client.phoneNormalized) ?? normalizePhone(client.phone);
  const emailsNormalized = Array.from(
    new Set(
      [emailNormalized, ...(client.emailsNormalized ?? []).map(normalizeEmail)]
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return {
    emailNormalized,
    phoneNormalized,
    emailsNormalized,
  };
};

const applyInquiryPatch = (
  inquiry: Inquiry,
  patch: Partial<Inquiry>,
): Inquiry => ({
  ...inquiry,
  ...patch,
});

const stringArrayEqual = (a: string[] | null | undefined, b: string[]) => {
  const left = [...(a ?? [])].sort();
  const right = [...b].sort();
  return JSON.stringify(left) === JSON.stringify(right);
};

const buildClientInquirySyncPatch = ({
  client,
  inquiryId,
  inquiry,
  emailNormalized,
  phoneNormalized,
}: {
  client: Client;
  inquiryId: string;
  inquiry: Inquiry;
  emailNormalized: string | null;
  phoneNormalized: string | null;
}) => {
  const patch: Record<string, unknown> = {};

  const email = nonEmptyString(inquiry.email);
  if (email && !(client.emails ?? []).includes(email)) {
    patch.emails = arrayUnion(email);
  }

  if (
    emailNormalized &&
    !(client.emailsNormalized ?? []).includes(emailNormalized)
  ) {
    patch.emailsNormalized = arrayUnion(emailNormalized);
  }

  if (!(client.inquiryIds ?? []).includes(inquiryId)) {
    patch.inquiryIds = arrayUnion(inquiryId);
  }

  if (
    phoneNormalized &&
    (!client.phoneNormalized || String(client.phoneNormalized).trim() === "")
  ) {
    patch.phoneNormalized = phoneNormalized;
  }

  const inquiryCreatedAtIso =
    toIsoDateTime(inquiry.createdAt ?? inquiry.created_at ?? inquiry.dateCreated) ??
    null;
  const clientLastInquiryAtMs = toMillis(client.lastInquiryAt);
  const inquiryCreatedAtMs = toMillis(inquiryCreatedAtIso);

  if (
    inquiryCreatedAtIso &&
    (!clientLastInquiryAtMs || inquiryCreatedAtMs > clientLastInquiryAtMs)
  ) {
    patch.lastInquiryAt = inquiryCreatedAtIso;
  }

  if (Object.keys(patch).length > 0) {
    patch.updatedAt = serverTimestamp();
  }

  return patch;
};

const findMatchingClientForInquiryFromClients = (
  inquiry: Inquiry,
  clients: Client[],
): InquiryMatchResult => {
  const emailNormalized =
    normalizeEmail(inquiry.emailNormalized) ?? normalizeEmail(inquiry.email);
  const phoneNormalized =
    normalizePhone(inquiry.phoneNormalized) ?? normalizePhone(inquiry.phoneNumber);

  const candidates = clients.filter((client) => {
    const clientIdentity = getClientIdentity(client);

    const emailMatch =
      !!emailNormalized &&
      (clientIdentity.emailNormalized === emailNormalized ||
        clientIdentity.emailsNormalized.includes(emailNormalized));
    const phoneMatch =
      !!phoneNormalized && clientIdentity.phoneNormalized === phoneNormalized;

    return emailMatch || phoneMatch;
  });

  if (candidates.length === 1) {
    return {
      status: "linked",
      client: candidates[0],
      candidates,
      emailNormalized,
      phoneNormalized,
    };
  }

  return {
    status: candidates.length > 1 ? "ambiguous_match" : "no_match",
    client: null,
    candidates,
    emailNormalized,
    phoneNormalized,
  };
};

export const buildEventDraftFromInquiry = (
  inquiry: Inquiry,
): Omit<EventDraft, "clientId"> => ({
  eventName: nonEmptyString(inquiry.eventName),
  eventDate: nonEmptyString(inquiry.eventDate) ?? "",
  startTime: nonEmptyString(inquiry.startTime),
  endTime: nonEmptyString(inquiry.endTime),
  siteAddress: nonEmptyString(inquiry.siteAddress),
  siteContact:
    [inquiry.firstName, inquiry.lastName].filter(Boolean).join(" ").trim() || null,
  plannedGuestCount: nonEmptyString(inquiry.plannedGuestCount),
  notes: nonEmptyString(inquiry.notes),
  eventStatus: "unprocessed",
});

export async function findMatchingClientForInquiry(
  db: Firestore,
  inquiry: Inquiry,
): Promise<InquiryMatchResult> {
  void db;
  const clients = await fetchClients();
  return findMatchingClientForInquiryFromClients(inquiry, clients);
}

export async function convertInquiryToEvent(
  db: Firestore,
  {
    inquiry,
    eventDraft,
  }: {
    inquiry: Inquiry;
    eventDraft: EventDraft;
  },
): Promise<ConvertInquiryToEventResult> {
  const inquiryId = getInquiryDocId(inquiry);
  if (!inquiryId) {
    throw new Error("Inquiry is missing a Firestore document id.");
  }

  const clients = await fetchClients();
  void db;
  const inquiryMatch = findMatchingClientForInquiryFromClients(inquiry, clients);

  const matchedClient =
    nonEmptyString(eventDraft.clientId) != null
      ? clients.find((client) => client.id === eventDraft.clientId) ?? null
      : inquiryMatch.client;

  if (!matchedClient && inquiryMatch.status === "ambiguous_match") {
    throw new Error(
      "Multiple client matches were found for this inquiry. Select the client manually before creating the event.",
    );
  }

  const batch = writeBatch(db);
  const inquiryRef = doc(db, "eventInquiries", inquiryId);
  const eventRef = doc(collection(db, "events"));
  const createdAtIso =
    toIsoDateTime(inquiry.createdAt ?? inquiry.created_at ?? inquiry.dateCreated) ??
    new Date().toISOString();

  let clientId = matchedClient?.id ?? "";
  let createdClient = false;

  if (!matchedClient) {
    const clientRef = doc(collection(db, "clientProfiles"));
    clientId = clientRef.id;
    createdClient = true;

    const emailNormalized = inquiryMatch.emailNormalized;
    const phoneNormalized = inquiryMatch.phoneNormalized;
    const email = nonEmptyString(inquiry.email);

    batch.set(clientRef, {
      firstName: nonEmptyString(inquiry.firstName) ?? "",
      lastName: nonEmptyString(inquiry.lastName) ?? "",
      company: nonEmptyString(inquiry.company),
      email,
      phone: nonEmptyString(inquiry.phoneNumber),
      phoneNormalized,
      notes: null,
      emails: email ? [email] : [],
      emailsNormalized: emailNormalized ? [emailNormalized] : [],
      inquiryIds: [inquiryId],
      lastInquiryAt: createdAtIso,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    clientId = matchedClient.id;
  }

  const clientRef = doc(db, "clientProfiles", clientId);
  const resolvedClientName = matchedClient
    ? getClientDisplayName(matchedClient)
    : [
        nonEmptyString(inquiry.firstName),
        nonEmptyString(inquiry.lastName),
      ]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      nonEmptyString(inquiry.company) ||
      nonEmptyString(inquiry.email) ||
      "Unknown client";

  batch.update(inquiryRef, {
    clientId,
    emailNormalized: inquiryMatch.emailNormalized,
    phoneNormalized: inquiryMatch.phoneNormalized,
    matchStatus: "linked",
    matchCandidates: [clientId],
  });

  batch.set(eventRef, {
    clientId,
    clientRef,
    clientName: resolvedClientName,
    sourceInquiryId: inquiryId,
    siteContact: nonEmptyString(eventDraft.siteContact) ?? "",
    eventDate: nonEmptyString(eventDraft.eventDate) ?? "",
    startTime: nonEmptyString(eventDraft.startTime) ?? "",
    endTime: nonEmptyString(eventDraft.endTime) ?? "",
    siteAddress: nonEmptyString(eventDraft.siteAddress) ?? "",
    phoneNumber: inquiryMatch.phoneNormalized ?? nonEmptyString(inquiry.phoneNumber) ?? "",
    plannedGuestCount:
      nonEmptyString(eventDraft.plannedGuestCount) ??
      nonEmptyString(inquiry.plannedGuestCount) ??
      "",
    operation: nonEmptyString(inquiry.operation),
    package: nonEmptyString(inquiry.package),
    eventName: nonEmptyString(eventDraft.eventName),
    notes: nonEmptyString(eventDraft.notes) ?? "",
    cost: "",
    eventStatus: nonEmptyString(eventDraft.eventStatus) ?? "unprocessed",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  return {
    eventId: eventRef.id,
    clientId,
    createdClient,
  };
}

export async function reconcileInquiryClientLinks(
  db: Firestore,
  inquiries: Inquiry[],
): Promise<ReconcileInquiryLinksResult> {
  const clients = await fetchClients();
  let batch = writeBatch(db);
  let pendingWrites = 0;
  let changedCount = 0;

  const flush = async () => {
    if (pendingWrites === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    pendingWrites = 0;
  };

  for (const inquiry of inquiries) {
    const inquiryId = getInquiryDocId(inquiry);
    if (!inquiryId) continue;

    const inquiryRef = doc(db, "eventInquiries", inquiryId);
    const normalizedEmail =
      normalizeEmail(inquiry.emailNormalized) ?? normalizeEmail(inquiry.email);
    const normalizedPhone =
      normalizePhone(inquiry.phoneNormalized) ?? normalizePhone(inquiry.phoneNumber);

    const linkedClientId = nonEmptyString(inquiry.clientId);

    if (linkedClientId) {
      const inquiryPatch: Record<string, unknown> = {};
      if ((inquiry.emailNormalized ?? null) !== normalizedEmail) {
        inquiryPatch.emailNormalized = normalizedEmail;
      }
      if ((inquiry.phoneNormalized ?? null) !== normalizedPhone) {
        inquiryPatch.phoneNormalized = normalizedPhone;
      }
      if (inquiry.matchStatus !== "linked") {
        inquiryPatch.matchStatus = "linked";
      }
      if (!stringArrayEqual(inquiry.matchCandidates, [linkedClientId])) {
        inquiryPatch.matchCandidates = [linkedClientId];
      }

      if (Object.keys(inquiryPatch).length > 0) {
        batch.update(inquiryRef, inquiryPatch);
        pendingWrites += 1;
        changedCount += 1;
      }

      const linkedClient =
        clients.find((client) => client.id === linkedClientId) ?? null;
      if (linkedClient) {
        const clientRef = doc(db, "clientProfiles", linkedClient.id);
        const clientPatch = buildClientInquirySyncPatch({
          client: linkedClient,
          inquiryId,
          inquiry,
          emailNormalized: normalizedEmail,
          phoneNormalized: normalizedPhone,
        });
        if (Object.keys(clientPatch).length > 0) {
          batch.set(clientRef, clientPatch, { merge: true });
          pendingWrites += 1;
        }
      }

      if (pendingWrites >= 400) {
        await flush();
      }
      continue;
    }

    const match = findMatchingClientForInquiryFromClients(inquiry, clients);
    const desiredCandidates =
      match.status === "linked"
        ? [match.client.id]
        : match.candidates.map((client) => client.id);

    const inquiryPatch: Record<string, unknown> = {};
    if ((inquiry.emailNormalized ?? null) !== match.emailNormalized) {
      inquiryPatch.emailNormalized = match.emailNormalized;
    }
    if ((inquiry.phoneNormalized ?? null) !== match.phoneNormalized) {
      inquiryPatch.phoneNormalized = match.phoneNormalized;
    }
    if ((inquiry.matchStatus ?? null) !== match.status) {
      inquiryPatch.matchStatus = match.status;
    }
    if (!stringArrayEqual(inquiry.matchCandidates, desiredCandidates)) {
      inquiryPatch.matchCandidates = desiredCandidates;
    }

    if (match.status === "linked") {
      inquiryPatch.clientId = match.client.id;
    }

    if (Object.keys(inquiryPatch).length > 0) {
      batch.update(inquiryRef, inquiryPatch);
      pendingWrites += 1;
      changedCount += 1;
    }

    if (match.status === "linked") {
      const clientRef = doc(db, "clientProfiles", match.client.id);
      const clientPatch = buildClientInquirySyncPatch({
        client: match.client,
        inquiryId,
        inquiry,
        emailNormalized: match.emailNormalized,
        phoneNormalized: match.phoneNormalized,
      });
      if (Object.keys(clientPatch).length > 0) {
        batch.set(clientRef, clientPatch, { merge: true });
        pendingWrites += 1;
      }
    }

    if (pendingWrites >= 400) {
      await flush();
    }
  }

  await flush();

  return { changedCount };
}

export async function linkInquiryToClient(
  db: Firestore,
  {
    inquiry,
    clientId,
  }: {
    inquiry: Inquiry;
    clientId: string;
  },
): Promise<LinkInquiryToClientResult> {
  const inquiryId = getInquiryDocId(inquiry);
  if (!inquiryId) {
    throw new Error("Inquiry is missing a Firestore document id.");
  }

  const clients = await fetchClients();
  const client = clients.find((item) => item.id === clientId);
  if (!client) {
    throw new Error("Selected client was not found.");
  }

  const emailNormalized =
    normalizeEmail(inquiry.emailNormalized) ?? normalizeEmail(inquiry.email);
  const phoneNormalized =
    normalizePhone(inquiry.phoneNormalized) ?? normalizePhone(inquiry.phoneNumber);

  const inquiryPatch: Partial<Inquiry> = {
    clientId: client.id,
    emailNormalized,
    phoneNormalized,
    matchStatus: "manual_override",
    matchCandidates: [client.id],
  };

  const batch = writeBatch(db);
  const inquiryRef = doc(db, "eventInquiries", inquiryId);
  const clientRef = doc(db, "clientProfiles", client.id);

  batch.update(inquiryRef, inquiryPatch);

  const clientPatch = buildClientInquirySyncPatch({
    client,
    inquiryId,
    inquiry,
    emailNormalized,
    phoneNormalized,
  });
  if (Object.keys(clientPatch).length > 0) {
    batch.set(clientRef, clientPatch, { merge: true });
  }

  await batch.commit();

  return {
    inquiry: applyInquiryPatch(inquiry, inquiryPatch),
    clientId: client.id,
  };
}

export async function createClientFromInquiryAndLink(
  db: Firestore,
  inquiry: Inquiry,
): Promise<LinkInquiryToClientResult> {
  const inquiryId = getInquiryDocId(inquiry);
  if (!inquiryId) {
    throw new Error("Inquiry is missing a Firestore document id.");
  }

  const emailNormalized =
    normalizeEmail(inquiry.emailNormalized) ?? normalizeEmail(inquiry.email);
  const phoneNormalized =
    normalizePhone(inquiry.phoneNormalized) ?? normalizePhone(inquiry.phoneNumber);
  const email = nonEmptyString(inquiry.email);

  const clientRef = doc(collection(db, "clientProfiles"));
  const inquiryRef = doc(db, "eventInquiries", inquiryId);
  const createdAtIso =
    toIsoDateTime(inquiry.createdAt ?? inquiry.created_at ?? inquiry.dateCreated) ??
    new Date().toISOString();

  const inquiryPatch: Partial<Inquiry> = {
    clientId: clientRef.id,
    emailNormalized,
    phoneNormalized,
    matchStatus: "manual_override",
    matchCandidates: [clientRef.id],
  };

  const batch = writeBatch(db);
  batch.set(clientRef, {
    firstName: nonEmptyString(inquiry.firstName) ?? "",
    lastName: nonEmptyString(inquiry.lastName) ?? "",
    company: nonEmptyString(inquiry.company),
    email,
    phone: nonEmptyString(inquiry.phoneNumber),
    phoneNormalized,
    notes: null,
    emails: email ? [email] : [],
    emailsNormalized: emailNormalized ? [emailNormalized] : [],
    inquiryIds: [inquiryId],
    lastInquiryAt: createdAtIso,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(inquiryRef, inquiryPatch);

  await batch.commit();

  return {
    inquiry: applyInquiryPatch(inquiry, inquiryPatch),
    clientId: clientRef.id,
  };
}
