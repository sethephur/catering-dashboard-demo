import React from "react";
import { doc } from "firebase/firestore";
import { DEMO_MODE_ENABLED } from "@/config/appInfo";
import { NewEventDialog } from "@/components/events/NewEventDialog";
import { createEvent } from "@/data/events";
import {
  buildEventDraftFromInquiry,
  convertInquiryToEvent,
  type EventDraft,
  findMatchingClientForInquiry,
} from "@/data/inquiryWorkflow";
import { useClients } from "@/data/clients";
import { database } from "@/utils/firebaseConfig";
import { Client, Inquiry } from "@/shared-types";

type OpenOptions = {
  defaultClientId?: string;
  sourceInquiry?: Inquiry;
};

type Ctx = {
  openNewEventDialog: (opts?: OpenOptions) => void;
  closeNewEventDialog: () => void;
};

const NewEventDialogContext = React.createContext<Ctx | null>(null);

export function NewEventDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [defaultClientId, setDefaultClientId] = React.useState<
    string | undefined
  >(undefined);
  const [sourceInquiry, setSourceInquiry] = React.useState<Inquiry | null>(null);

  // Loading once here so every page gets the same list without re-wiring state
  const {
    data: clients = [],
    isLoading: clientsLoading,
    error: clientsError,
  } = useClients();

  const dialogClients = React.useMemo(() => {
    const normalize = (v: unknown) => {
      if (v == null) return "";
      const s = String(v).trim();
      const lowered = s.toLowerCase();
      return s === "" || lowered === "undefined" || lowered === "null" ? "" : s;
    };

    return clients.map((c: Client | any) => {
      const first = normalize(c.firstName);
      const last = normalize(c.lastName);
      const company = normalize(c.company);
      const email = normalize(c.email);

      const displayName =
        [first, last].filter(Boolean).join(" ") || company || email || "—";

      return {
        id: c.id,
        name: displayName,
        company: company || undefined,
      };
    });
  }, [clients]);

  React.useEffect(() => {
    console.debug(
      "[NewEventDialogProvider] clientsLoading:",
      clientsLoading,
      "raw:",
      clients.length,
      "dialog:",
      dialogClients.length,
      { sample: dialogClients[0] }
    );
  }, [clientsLoading, clients, dialogClients]);

  const openNewEventDialog = React.useCallback(async (opts?: OpenOptions) => {
    const nextSourceInquiry = opts?.sourceInquiry ?? null;
    setSourceInquiry(nextSourceInquiry);

    if (opts?.defaultClientId) {
      setDefaultClientId(opts.defaultClientId);
      setOpen(true);
      return;
    }

    if (!nextSourceInquiry) {
      setDefaultClientId(undefined);
      setOpen(true);
      return;
    }

    if (DEMO_MODE_ENABLED) {
      setDefaultClientId(nextSourceInquiry.clientId ?? undefined);
      setOpen(true);
      return;
    }

    try {
      const match = await findMatchingClientForInquiry(database, nextSourceInquiry);
      setDefaultClientId(match.status === "linked" ? match.client.id : undefined);
    } catch (error) {
      console.error("[NewEventDialogProvider] Failed to pre-match inquiry:", error);
      setDefaultClientId(undefined);
    }

    setOpen(true);
  }, []);

  const closeNewEventDialog = React.useCallback(() => {
    setOpen(false);
    setDefaultClientId(undefined);
    setSourceInquiry(null);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    if (!clientsLoading && !clientsError && dialogClients.length === 0) {
      console.warn(
        "[NewEventDialogProvider] No clients available. Check collection name, read rules, or data shape."
      );
    }
  }, [open, clientsError, clientsLoading, dialogClients.length]);

  const onCreate = async (
    payload: EventDraft,
  ) => {
    if (DEMO_MODE_ENABLED) {
      const selectedClient =
        clients.find((client) => client.id === payload.clientId) ?? null;

      await createEvent(database, {
        ...payload,
        clientId: payload.clientId ?? sourceInquiry?.clientId ?? "",
        clientRef: null,
        sourceInquiryId: sourceInquiry?.docId ?? null,
        clientName: selectedClient
          ? [selectedClient.firstName, selectedClient.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() ||
            selectedClient.company ||
            selectedClient.email ||
            "Unknown client"
          : undefined,
      } as Parameters<typeof createEvent>[1]);
      return;
    }

    if (sourceInquiry) {
      await convertInquiryToEvent(database, {
        inquiry: sourceInquiry,
        eventDraft: payload,
      });
      return;
    }

    if (!payload.clientId) {
      throw new Error("Client is required to create an event.");
    }

    const selectedClient =
      clients.find((client) => client.id === payload.clientId) ?? null;

    await createEvent(database, {
      ...payload,
      clientId: payload.clientId,
      clientRef: doc(database, "clientProfiles", payload.clientId),
      clientName: selectedClient
        ? [selectedClient.firstName, selectedClient.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          selectedClient.company ||
          selectedClient.email ||
          "Unknown client"
        : undefined,
    } as Parameters<typeof createEvent>[1]);
  };

  return (
    <NewEventDialogContext.Provider
      value={{ openNewEventDialog, closeNewEventDialog }}
    >
      {children}
      <NewEventDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeNewEventDialog();
            return;
          }
          setOpen(true);
        }}
        clients={dialogClients}
        clientsLoading={clientsLoading}
        onCreate={onCreate}
        defaultClientId={defaultClientId}
        clientSelectionOptional={!!sourceInquiry}
        initialValues={
          sourceInquiry ? buildEventDraftFromInquiry(sourceInquiry) : undefined
        }
      />
    </NewEventDialogContext.Provider>
  );
}

export function useNewEventDialog() {
  const ctx = React.useContext(NewEventDialogContext);
  if (!ctx)
    throw new Error(
      "useNewEventDialog must be used within NewEventDialogProvider"
    );
  return ctx;
}
