import { useEffect, useMemo, useState } from "react";
import { MessageSquareMore, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { database } from "@/utils/firebaseConfig";
import {
  addSupportReply,
  subscribeHelpTicketMessages,
  subscribeHelpTickets,
  updateHelpTicketStatus,
} from "@/data/helpTickets";
import type {
  HelpTicket,
  HelpTicketMessage,
  HelpTicketStatus,
} from "@/shared-types";

const supportStatuses: {
  value: HelpTicketStatus;
  label: string;
}[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "pending_requester", label: "Pending requester" },
  { value: "closed", label: "Closed" },
];

const toMillis = (value: unknown) => {
  if (
    typeof value === "object" &&
    value != null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }

  if (
    typeof value === "object" &&
    value != null &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

const formatDateTime = (value: unknown) => {
  const ms = toMillis(value);
  if (!ms) return "Unknown time";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
};

const supportStatusVariant = (status: HelpTicketStatus) => {
  switch (status) {
    case "closed":
      return "secondary";
    case "pending_requester":
      return "outline";
    case "in_progress":
      return "default";
    default:
      return "destructive";
  }
};

export default function Support() {
  const [tickets, setTickets] = useState<HelpTicket[]>([]);
  const [messages, setMessages] = useState<HelpTicketMessage[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [statusDraft, setStatusDraft] = useState<HelpTicketStatus>("open");
  const [replyBody, setReplyBody] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    const unsub = subscribeHelpTickets(database, {
      onData: (nextTickets) => {
        setTickets(nextTickets);
      },
      onError: (error) => {
        console.error("Failed to load help tickets:", error);
        toast.error("Failed to load help tickets.");
      },
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (tickets.length === 0) {
      setSelectedTicketId("");
      return;
    }

    if (!selectedTicketId || !tickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [selectedTicketId, tickets]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets],
  );

  useEffect(() => {
    if (!selectedTicket) {
      setStatusDraft("open");
      return;
    }

    setStatusDraft(selectedTicket.status);
  }, [selectedTicket]);

  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }

    const unsub = subscribeHelpTicketMessages(database, selectedTicketId, {
      onData: setMessages,
      onError: (error) => {
        console.error("Failed to load help ticket messages:", error);
        toast.error("Failed to load ticket conversation.");
      },
    });

    return () => unsub();
  }, [selectedTicketId]);

  const ticketCounts = useMemo(() => {
    const counts = {
      open: 0,
      in_progress: 0,
      pending_requester: 0,
      closed: 0,
    } satisfies Record<HelpTicketStatus, number>;

    for (const ticket of tickets) {
      counts[ticket.status] += 1;
    }

    return counts;
  }, [tickets]);

  const handleSaveStatus = async () => {
    if (!selectedTicket) return;
    if (selectedTicket.status === statusDraft) return;

    setSavingStatus(true);
    try {
      await updateHelpTicketStatus({
        db: database,
        ticketId: selectedTicket.id,
        status: statusDraft,
      });
      toast.success("Ticket status updated.");
    } catch (error) {
      console.error("Failed to update help ticket status:", error);
      toast.error("Failed to update ticket status.");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket) return;
    if (!replyBody.trim()) {
      toast.error("Add a reply before sending.");
      return;
    }

    setSendingReply(true);
    try {
      await addSupportReply({
        db: database,
        ticketId: selectedTicket.id,
        body: replyBody,
        status:
          statusDraft === "closed" ? "closed" : "pending_requester",
      });
      setReplyBody("");
      toast.success(
        selectedTicket.email
          ? "Reply saved. Email delivery will be handled by the backend function."
          : "Reply saved. This ticket has no requester email, so no external email can be sent.",
      );
    } catch (error) {
      console.error("Failed to send support reply:", error);
      toast.error("Failed to send support reply.");
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Support Inbox</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Review help tickets, update ticket status, and send support replies
              from inside the workspace.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Open</CardDescription>
            <CardTitle className="text-2xl">{ticketCounts.open}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>In progress</CardDescription>
            <CardTitle className="text-2xl">{ticketCounts.in_progress}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending requester</CardDescription>
            <CardTitle className="text-2xl">
              {ticketCounts.pending_requester}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Closed</CardDescription>
            <CardTitle className="text-2xl">{ticketCounts.closed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="min-h-0">
          <CardHeader>
            <CardTitle>Tickets</CardTitle>
            <CardDescription>
              {tickets.length} total ticket{tickets.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                No support tickets yet.
              </div>
            ) : (
              tickets.map((ticket) => {
                const isActive = ticket.id === selectedTicketId;
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      isActive
                        ? "border-primary bg-accent/40"
                        : "border-border hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {ticket.name || ticket.email || "Anonymous requester"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {ticket.category || "Uncategorized"}
                        </p>
                      </div>
                      <Badge variant={supportStatusVariant(ticket.status)}>
                        {supportStatuses.find((item) => item.value === ticket.status)
                          ?.label ?? ticket.status}
                      </Badge>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                      {ticket.lastMessagePreview || ticket.message}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">
                        {ticket.locationHint || ticket.source || "Dashboard"}
                      </span>
                      <span>{formatDateTime(ticket.lastMessageAt || ticket.updatedAt || ticket.createdAt)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="min-h-0">
          {selectedTicket ? (
            <>
              <CardHeader className="gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle>
                        {selectedTicket.name ||
                          selectedTicket.email ||
                          "Anonymous requester"}
                      </CardTitle>
                      <Badge variant={supportStatusVariant(selectedTicket.status)}>
                        {supportStatuses.find(
                          (item) => item.value === selectedTicket.status,
                        )?.label ?? selectedTicket.status}
                      </Badge>
                    </div>
                    <CardDescription className="space-y-1">
                      <p>{selectedTicket.email || "No requester email provided"}</p>
                      <p>{selectedTicket.category || "No category"}</p>
                      <p>{selectedTicket.locationHint || "No workflow/page noted"}</p>
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={statusDraft}
                      onValueChange={(value) =>
                        setStatusDraft(value as HelpTicketStatus)
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Update status" />
                      </SelectTrigger>
                      <SelectContent>
                        {supportStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={handleSaveStatus}
                      disabled={savingStatus || statusDraft === selectedTicket.status}
                    >
                      {savingStatus ? "Saving..." : "Save status"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      <MessageSquareMore className="size-3.5" />
                      <span>Initial request</span>
                      <span>{formatDateTime(selectedTicket.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {selectedTicket.message}
                    </p>
                  </div>

                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-xl border p-4 ${
                        message.authorType === "support"
                          ? "border-primary/30 bg-primary/5"
                          : "bg-muted/20"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {message.authorType === "support" ? (
                          <ShieldAlert className="size-3.5" />
                        ) : (
                          <MessageSquareMore className="size-3.5" />
                        )}
                        <span>
                          {message.authorType === "support"
                            ? message.authorName || "Support"
                            : message.authorName || "Requester"}
                        </span>
                        <span>{formatDateTime(message.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {message.body}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label htmlFor="support-reply">Reply</Label>
                  <Textarea
                    id="support-reply"
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    placeholder="Write a reply to the requester. If the ticket has an email address, the backend can email this response."
                    className="min-h-36"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={handleSendReply} disabled={sendingReply}>
                      <Send className="mr-2 size-4" />
                      {sendingReply ? "Sending..." : "Send reply"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {selectedTicket.email
                        ? `Replies can be emailed to ${selectedTicket.email} by the backend function.`
                        : "This ticket does not include a requester email, so replies will remain internal only unless you follow up another way."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
              Select a ticket to review it.
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
