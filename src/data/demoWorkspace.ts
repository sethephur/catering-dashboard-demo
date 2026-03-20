import type { Client, HelpTicket, HelpTicketMessage, TEvent } from "@/shared-types";

type Listener<T> = (items: T[]) => void;

const createCollectionStore = <T extends { id?: string | null }>(initial: T[]) => {
  let items = [...initial];
  const listeners = new Set<Listener<T>>();

  const emit = () => {
    const snapshot = [...items];
    listeners.forEach((listener) => listener(snapshot));
  };

  return {
    getAll: () => [...items],
    subscribe: (listener: Listener<T>) => {
      listener([...items]);
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    create: (item: T) => {
      items = [item, ...items];
      emit();
      return item;
    },
    update: (id: string, updater: (current: T) => T) => {
      items = items.map((item) => (item.id === id ? updater(item) : item));
      emit();
    },
    remove: (id: string) => {
      items = items.filter((item) => item.id !== id);
      emit();
    },
  };
};

const createMessageStore = (
  initial: Record<string, HelpTicketMessage[]>,
) => {
  let messagesByTicketId = Object.fromEntries(
    Object.entries(initial).map(([ticketId, messages]) => [ticketId, [...messages]]),
  ) as Record<string, HelpTicketMessage[]>;
  const listeners = new Map<string, Set<Listener<HelpTicketMessage>>>();

  const emit = (ticketId: string) => {
    const snapshot = [...(messagesByTicketId[ticketId] ?? [])];
    listeners.get(ticketId)?.forEach((listener) => listener(snapshot));
  };

  return {
    getAll: (ticketId: string) => [...(messagesByTicketId[ticketId] ?? [])],
    subscribe: (ticketId: string, listener: Listener<HelpTicketMessage>) => {
      listener([...(messagesByTicketId[ticketId] ?? [])]);
      const ticketListeners = listeners.get(ticketId) ?? new Set();
      ticketListeners.add(listener);
      listeners.set(ticketId, ticketListeners);
      return () => {
        ticketListeners.delete(listener);
        if (ticketListeners.size === 0) {
          listeners.delete(ticketId);
        }
      };
    },
    append: (ticketId: string, message: HelpTicketMessage) => {
      messagesByTicketId = {
        ...messagesByTicketId,
        [ticketId]: [...(messagesByTicketId[ticketId] ?? []), message],
      };
      emit(ticketId);
    },
  };
};

const iso = (value: string) => value;

const INITIAL_CLIENTS: Client[] = [
  {
    id: "demo-client-brightwell",
    firstName: "Jordan",
    lastName: "Patel",
    company: "Brightwell Health",
    email: "jordan.patel@example.com",
    phone: "(555) 010-1002",
    phoneNormalized: "5550101002",
    emails: ["jordan.patel@example.com"],
    emailsNormalized: ["jordan.patel@example.com"],
    inquiryIds: ["demo-inquiry-102"],
    lastInquiryAt: iso("2026-03-20T08:05:00-07:00"),
    events: null,
    createdAt: iso("2026-02-14T11:00:00-08:00"),
    updatedAt: iso("2026-03-20T08:05:00-07:00"),
  },
  {
    id: "demo-client-lakehouse",
    firstName: "Casey",
    lastName: "Brooks",
    company: "Lakehouse Academy",
    email: "casey.brooks@example.com",
    phone: "(555) 010-1004",
    phoneNormalized: "5550101004",
    emails: ["casey.brooks@example.com"],
    emailsNormalized: ["casey.brooks@example.com"],
    inquiryIds: ["demo-inquiry-104"],
    lastInquiryAt: iso("2026-03-19T11:20:00-07:00"),
    events: null,
    createdAt: iso("2026-01-22T10:00:00-08:00"),
    updatedAt: iso("2026-03-19T11:20:00-07:00"),
  },
  {
    id: "demo-client-summit",
    firstName: "Riley",
    lastName: "Campbell",
    company: "Summit Real Estate",
    email: "riley.campbell@example.com",
    phone: "(555) 010-1006",
    phoneNormalized: "5550101006",
    emails: ["riley.campbell@example.com"],
    emailsNormalized: ["riley.campbell@example.com"],
    inquiryIds: ["demo-inquiry-106"],
    lastInquiryAt: iso("2026-03-18T09:10:00-07:00"),
    events: null,
    createdAt: iso("2026-02-02T09:30:00-08:00"),
    updatedAt: iso("2026-03-18T09:10:00-07:00"),
  },
  {
    id: "demo-client-harbor",
    firstName: "Sam",
    lastName: "Rivera",
    company: "Harbor Youth Sports",
    email: "sam.rivera@example.com",
    phone: "(555) 010-1010",
    phoneNormalized: "5550101010",
    emails: ["sam.rivera@example.com"],
    emailsNormalized: ["sam.rivera@example.com"],
    inquiryIds: ["demo-inquiry-110"],
    lastInquiryAt: iso("2026-03-16T07:55:00-07:00"),
    events: null,
    createdAt: iso("2026-01-11T13:00:00-08:00"),
    updatedAt: iso("2026-03-16T07:55:00-07:00"),
  },
  {
    id: "demo-client-signal",
    firstName: "Reese",
    lastName: "Ward",
    company: "Signal Peak Advisors",
    email: "reese.ward@example.com",
    phone: "(555) 010-1014",
    phoneNormalized: "5550101014",
    emails: ["reese.ward@example.com"],
    emailsNormalized: ["reese.ward@example.com"],
    inquiryIds: ["demo-inquiry-114"],
    lastInquiryAt: iso("2026-03-14T08:30:00-07:00"),
    events: null,
    createdAt: iso("2026-02-18T15:15:00-08:00"),
    updatedAt: iso("2026-03-14T08:30:00-07:00"),
  },
  {
    id: "demo-client-pinecrest",
    firstName: "Harper",
    lastName: "Mills",
    company: "Pinecrest Elementary PTA",
    email: "harper.mills@example.com",
    phone: "(555) 010-1016",
    phoneNormalized: "5550101016",
    emails: ["harper.mills@example.com"],
    emailsNormalized: ["harper.mills@example.com"],
    inquiryIds: ["demo-inquiry-116"],
    lastInquiryAt: iso("2026-03-13T09:00:00-07:00"),
    events: null,
    createdAt: iso("2026-01-08T10:45:00-08:00"),
    updatedAt: iso("2026-03-13T09:00:00-07:00"),
  },
];

const INITIAL_EVENTS: TEvent[] = [
  {
    id: "demo-event-201",
    clientId: "demo-client-brightwell",
    clientName: "Jordan Patel",
    clientRef: null,
    sourceInquiryId: "demo-inquiry-102",
    siteContact: "Jordan Patel",
    eventDate: "2026-04-24",
    startTime: "12:00",
    endTime: "14:00",
    siteAddress: "88 Citrus Way, Northfield, CA",
    phoneNumber: "(555) 010-1002",
    plannedGuestCount: "120",
    operation: "Tableside",
    package: "Catering Cups",
    eventName: "Wellness Week Finale",
    notes: "Single-serve cups and labeled dairy-free option.",
    cost: "1080",
    eventStatus: "started",
    createdAt: iso("2026-03-05T09:00:00-08:00"),
    updatedAt: iso("2026-03-12T16:20:00-07:00"),
  },
  {
    id: "demo-event-202",
    clientId: "demo-client-lakehouse",
    clientName: "Casey Brooks",
    clientRef: null,
    sourceInquiryId: "demo-inquiry-104",
    siteContact: "Casey Brooks",
    eventDate: "2026-05-09",
    startTime: "11:30",
    endTime: "13:30",
    siteAddress: "250 Scholar Lane, Scholar Heights, CA",
    phoneNumber: "(555) 010-1004",
    plannedGuestCount: "210",
    operation: "Truck",
    package: "Mini",
    eventName: "Family Fun Fair",
    notes: "School event with staggered lunch blocks.",
    cost: "1510",
    eventStatus: "unprocessed",
    createdAt: iso("2026-03-01T11:15:00-08:00"),
    updatedAt: iso("2026-03-19T11:20:00-07:00"),
  },
  {
    id: "demo-event-203",
    clientId: "demo-client-summit",
    clientName: "Riley Campbell",
    clientRef: null,
    sourceInquiryId: "demo-inquiry-106",
    siteContact: "Riley Campbell",
    eventDate: "2026-04-12",
    startTime: "13:00",
    endTime: "15:00",
    siteAddress: "610 Market Row, Bay Hollow, CA",
    phoneNumber: "(555) 010-1006",
    plannedGuestCount: "95",
    operation: "Truck",
    package: "Premium",
    eventName: "Open House Weekend",
    notes: "Need branded napkins and curbside setup.",
    cost: "1105",
    eventStatus: "completed",
    createdAt: iso("2026-02-27T14:40:00-08:00"),
    updatedAt: iso("2026-03-18T09:10:00-07:00"),
  },
  {
    id: "demo-event-204",
    clientId: "demo-client-harbor",
    clientName: "Sam Rivera",
    clientRef: null,
    sourceInquiryId: "demo-inquiry-110",
    siteContact: "Sam Rivera",
    eventDate: "2026-04-05",
    startTime: "10:30",
    endTime: "12:30",
    siteAddress: "55 Victory Field Rd, Southport, CA",
    phoneNumber: "(555) 010-1010",
    plannedGuestCount: "240",
    operation: "Truck",
    package: "Mini",
    eventName: "Season Kickoff",
    notes: "Fast service lanes prioritized.",
    cost: "1690",
    eventStatus: "started",
    createdAt: iso("2026-02-21T12:10:00-08:00"),
    updatedAt: iso("2026-03-16T07:55:00-07:00"),
  },
  {
    id: "demo-event-205",
    clientId: "demo-client-signal",
    clientName: "Reese Ward",
    clientRef: null,
    sourceInquiryId: "demo-inquiry-114",
    siteContact: "Reese Ward",
    eventDate: "2026-05-14",
    startTime: "18:30",
    endTime: "20:30",
    siteAddress: "1 Skyline Center, Skybridge, CA",
    phoneNumber: "(555) 010-1014",
    plannedGuestCount: "110",
    operation: "Truck",
    package: "Premium",
    eventName: "Executive Retreat Closing Party",
    notes: "Need two vegan flavors and one nut-free lane.",
    cost: "1240",
    eventStatus: "unprocessed",
    createdAt: iso("2026-03-02T16:00:00-08:00"),
    updatedAt: iso("2026-03-14T08:30:00-07:00"),
  },
  {
    id: "demo-event-206",
    clientId: "demo-client-pinecrest",
    clientName: "Harper Mills",
    clientRef: null,
    sourceInquiryId: "demo-inquiry-116",
    siteContact: "Harper Mills",
    eventDate: "2026-05-30",
    startTime: "12:00",
    endTime: "14:30",
    siteAddress: "44 Juniper Rd, Cedar Park, CA",
    phoneNumber: "(555) 010-1016",
    plannedGuestCount: "260",
    operation: "Truck",
    package: "Fundraiser",
    eventName: "End of Year Carnival",
    notes: "Fundraiser format with kid-friendly top sellers.",
    cost: "1820",
    eventStatus: "unprocessed",
    createdAt: iso("2026-02-26T09:30:00-08:00"),
    updatedAt: iso("2026-03-13T09:00:00-07:00"),
  },
];

const INITIAL_HELP_TICKETS: HelpTicket[] = [
  {
    id: "demo-ticket-1",
    name: "Avery Lee",
    email: "avery.lee@example.com",
    category: "Workflow question",
    locationHint: "Inquiry modal on desktop",
    message: "Can we collapse older event notes by default in the inquiry detail view?",
    status: "open",
    source: "dashboard-help-page",
    lastMessagePreview: "Can we collapse older event notes by default in the inquiry detail view?",
    lastResponderType: "requester",
    createdAt: iso("2026-03-19T10:05:00-07:00"),
    updatedAt: iso("2026-03-19T10:05:00-07:00"),
    lastMessageAt: iso("2026-03-19T10:05:00-07:00"),
  },
  {
    id: "demo-ticket-2",
    name: "Jordan Patel",
    email: "jordan.patel@example.com",
    category: "Bug report",
    locationHint: "Reports page export button",
    message: "PDF export worked after refresh, but the first click did nothing.",
    status: "pending_requester",
    source: "dashboard-help-page",
    lastMessagePreview: "Could you confirm whether that happened in Chrome or Safari?",
    lastResponderType: "support",
    createdAt: iso("2026-03-18T14:20:00-07:00"),
    updatedAt: iso("2026-03-18T16:10:00-07:00"),
    lastMessageAt: iso("2026-03-18T16:10:00-07:00"),
  },
];

const INITIAL_HELP_MESSAGES: Record<string, HelpTicketMessage[]> = {
  "demo-ticket-1": [],
  "demo-ticket-2": [
    {
      id: "demo-ticket-2-message-1",
      authorType: "support",
      authorName: "Support",
      body: "Could you confirm whether that happened in Chrome or Safari?",
      createdAt: iso("2026-03-18T16:10:00-07:00"),
    },
  ],
};

export type DemoWorkspaceUser = {
  uid: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  disabled: boolean;
  creationTime: string | null;
  lastSignInTime: string | null;
};

let demoWorkspaceUsers: DemoWorkspaceUser[] = [
  {
    uid: "demo-admin-1",
    email: "demo.admin@example.com",
    displayName: "Demo Admin",
    isAdmin: true,
    disabled: false,
    creationTime: iso("2026-03-01T09:00:00-08:00"),
    lastSignInTime: iso("2026-03-20T09:00:00-07:00"),
  },
  {
    uid: "demo-user-1",
    email: "ops.lead@example.com",
    displayName: "Ops Lead",
    isAdmin: false,
    disabled: false,
    creationTime: iso("2026-03-03T11:00:00-08:00"),
    lastSignInTime: iso("2026-03-19T15:20:00-07:00"),
  },
];

const clientsStore = createCollectionStore<Client>(INITIAL_CLIENTS);
const eventsStore = createCollectionStore<TEvent>(INITIAL_EVENTS);
const ticketsStore = createCollectionStore<HelpTicket>(INITIAL_HELP_TICKETS);
const ticketMessagesStore = createMessageStore(INITIAL_HELP_MESSAGES);

let demoClientCounter = 300;
let demoEventCounter = 400;
let demoTicketCounter = 500;
let demoReplyCounter = 1;
let demoWorkspaceUserCounter = 10;

export const getDemoClients = () => clientsStore.getAll();
export const subscribeDemoClients = (listener: Listener<Client>) =>
  clientsStore.subscribe(listener);
export const createDemoClient = (client: Client) => clientsStore.create(client);
export const updateDemoClient = (id: string, updater: (current: Client) => Client) =>
  clientsStore.update(id, updater);
export const deleteDemoClient = (id: string) => clientsStore.remove(id);
export const nextDemoClientId = () => `demo-client-${demoClientCounter++}`;

export const getDemoEvents = () => eventsStore.getAll();
export const subscribeDemoEvents = (listener: Listener<TEvent>) =>
  eventsStore.subscribe(listener);
export const createDemoEvent = (event: TEvent) => eventsStore.create(event);
export const updateDemoEvent = (id: string, updater: (current: TEvent) => TEvent) =>
  eventsStore.update(id, updater);
export const deleteDemoEvent = (id: string) => eventsStore.remove(id);
export const nextDemoEventId = () => `demo-event-${demoEventCounter++}`;

export const getDemoHelpTickets = () => ticketsStore.getAll();
export const subscribeDemoHelpTickets = (listener: Listener<HelpTicket>) =>
  ticketsStore.subscribe(listener);
export const getDemoHelpMessages = (ticketId: string) =>
  ticketMessagesStore.getAll(ticketId);
export const subscribeDemoHelpMessages = (
  ticketId: string,
  listener: Listener<HelpTicketMessage>,
) => ticketMessagesStore.subscribe(ticketId, listener);
export const createDemoHelpTicket = (ticket: HelpTicket) => ticketsStore.create(ticket);
export const updateDemoHelpTicket = (
  id: string,
  updater: (current: HelpTicket) => HelpTicket,
) => ticketsStore.update(id, updater);
export const appendDemoHelpMessage = (
  ticketId: string,
  message: HelpTicketMessage,
) => ticketMessagesStore.append(ticketId, message);
export const nextDemoTicketId = () => `demo-ticket-${demoTicketCounter++}`;
export const nextDemoReplyId = (ticketId: string) =>
  `${ticketId}-message-${demoReplyCounter++}`;

export const listDemoWorkspaceUsers = () => [...demoWorkspaceUsers];
export const createStoredDemoWorkspaceUser = (user: DemoWorkspaceUser) => {
  demoWorkspaceUsers = [user, ...demoWorkspaceUsers];
  return user;
};
export const updateStoredDemoWorkspaceUser = (
  uid: string,
  updater: (current: DemoWorkspaceUser) => DemoWorkspaceUser,
) => {
  demoWorkspaceUsers = demoWorkspaceUsers.map((user) =>
    user.uid === uid ? updater(user) : user,
  );
  return demoWorkspaceUsers.find((user) => user.uid === uid) ?? null;
};
export const deleteStoredDemoWorkspaceUser = (uid: string) => {
  demoWorkspaceUsers = demoWorkspaceUsers.filter((user) => user.uid !== uid);
};
export const nextDemoWorkspaceUserId = () =>
  `demo-user-${demoWorkspaceUserCounter++}`;
