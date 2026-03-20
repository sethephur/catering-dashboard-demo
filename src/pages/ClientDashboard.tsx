import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DEMO_MODE_ENABLED } from "@/config/appInfo";
import { DEMO_INQUIRIES } from "@/data/demoInquiries";
import { fetchClients } from "@/data/clients";
import { database } from "../utils/firebaseConfig";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { subscribeEvents } from "../data/events";
import type { TEvent } from "../shared-types";
import { useNewEventDialog } from "@/providers/new-event-dialog";

type Unsub = () => void;

const todayYMD = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDate = (s: string) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatTime = (t: string) => {
  const [h, m] = (t || "").split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return t || "";
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function ClientDashboard() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<any | null>(null);
  const [events, setEvents] = useState<TEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { openNewEventDialog } = useNewEventDialog();
  const [inquiries, setInquiries] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!clientId) {
      setInquiries([]);
      return;
    }

    if (DEMO_MODE_ENABLED) {
      setInquiries(DEMO_INQUIRIES.filter((inquiry) => inquiry.clientId === clientId));
      return;
    }

    const linkedInquiriesQuery = query(
      collection(database, "eventInquiries"),
      where("clientId", "==", clientId),
    );

    const unsub = onSnapshot(linkedInquiriesQuery, (snap) => {
      const rows = snap.docs.map((inquiryDoc) => ({
        id: inquiryDoc.id,
        ...inquiryDoc.data(),
      }));
      setInquiries(rows);
    });

    return () => {
      unsub();
    };
  }, [clientId]);

  // Hold the live Firestore subscription so we can reattach/cleanup safely
  const eventsUnsubRef = useRef<Unsub | null>(null);

  // Attach a real-time listener for this client's events
  const attachEventsListener = (cid: string) => {
    const unsub = subscribeEvents(database, {
      clientId: cid,
      onData: (rows) => setEvents(rows),
      onError: (e) => setError(e?.message ?? "Failed to load events"),
    });
    eventsUnsubRef.current = unsub;
    return unsub;
  };

  useEffect(() => {
    if (!clientId) return;

    if (DEMO_MODE_ENABLED) {
      setLoading(true);
      setError(null);

      fetchClients()
        .then((rows) => {
          const match = rows.find((item) => item.id === clientId) ?? null;
          if (!match) {
            throw new Error("Client not found");
          }
          setClient(match);
        })
        .catch((e) => setError(e?.message ?? "Failed to load client"))
        .finally(() => setLoading(false));

      const unsub = attachEventsListener(clientId);
      eventsUnsubRef.current = unsub;

      return () => {
        if (eventsUnsubRef.current) {
          eventsUnsubRef.current();
          eventsUnsubRef.current = null;
        }
      };
    }

    const auth = getAuth();
    setLoading(true);
    setError(null);

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setEvents([]);
        setClient(null);
        setError("Please sign in to view this client.");
        setLoading(false);
        return;
      }

      // Client details
      const ref = doc(database, "clientProfiles", clientId);
      getDoc(ref)
        .then((snap) => {
          if (!snap.exists()) throw new Error("Client not found");
          const data = { id: snap.id, ...snap.data() } as any;
          setClient(data);
        })
        .catch((e) => setError(e?.message ?? "Failed to load client"))
        .finally(() => setLoading(false));

      // Events for client (live)
      const unsub = attachEventsListener(clientId);
      eventsUnsubRef.current = unsub;
    });

    return () => {
      if (eventsUnsubRef.current) {
        eventsUnsubRef.current();
        eventsUnsubRef.current = null;
      }
      unsubAuth();
    };
  }, [clientId]);

  const today = todayYMD();
  const upcoming = useMemo(
    () => events.filter((e) => (e.eventDate || "") >= today),
    [events, today]
  );
  const past = useMemo(
    () => events.filter((e) => (e.eventDate || "") < today),
    [events, today]
  );

  const sortedInquiries = useMemo(() => {
    return [...inquiries].sort((a, b) =>
      String(b.eventDate || "").localeCompare(String(a.eventDate || ""))
    );
  }, [inquiries]);

  return (
    <section className="mx-auto min-h-screen pt-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">
            {client
              ? `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim()
              : "Client"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button
            variant="secondary"
            onClick={() => clientId && attachEventsListener(clientId)}
          >
            Refresh
          </Button>
          <Button
            onClick={() => openNewEventDialog({ defaultClientId: clientId })}
          >
            New Event
          </Button>
        </div>
      </div>

      {loading && (
        <div className="mb-4 text-sm text-muted-foreground">Loading…</div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {client && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Client Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <div>
              <span className="font-medium text-foreground">Name:</span>{" "}
              {`${client.firstName ?? ""} ${client.lastName ?? ""}`.trim()}
            </div>
            {client.company && (
              <div>
                <span className="font-medium text-foreground">Company:</span>{" "}
                {client.company}
              </div>
            )}
            {client.email && (
              <div>
                <span className="font-medium text-foreground">Email:</span>{" "}
                {client.email}
              </div>
            )}
            {client.phone && (
              <div>
                <span className="font-medium text-foreground">Phone:</span>{" "}
                {client.phone}
              </div>
            )}
            {client.notes && (
              <div className="sm:col-span-2">
                <span className="font-medium text-foreground">Notes:</span>{" "}
                {client.notes}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {sortedInquiries.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Linked Inquiries ({sortedInquiries.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedInquiries.map((inq) => (
                  <TableRow key={inq.id}>
                    {inq.docId}
                    <TableCell>
                      {inq.eventDate ? formatDate(inq.eventDate) : "—"}
                    </TableCell>
                    <TableCell>
                      {`${inq.firstName ?? ""} ${inq.lastName ?? ""}`.trim() ||
                        "—"}
                    </TableCell>
                    <TableCell>{inq.email || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {inq.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events ({upcoming.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming events.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcoming.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.eventDate)}</TableCell>
                      <TableCell>
                        {formatTime(e.startTime)}
                        {e.endTime ? ` – ${formatTime(e.endTime)}` : ""}
                      </TableCell>
                      <TableCell>{e.eventName || "Untitled"}</TableCell>
                      <TableCell>{e.eventStatus || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Past Events ({past.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {past.length === 0 ? (
              <p className="text-sm text-muted-foreground">No past events.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {past.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.eventDate)}</TableCell>
                      <TableCell>
                        {formatTime(e.startTime)}
                        {e.endTime ? ` – ${formatTime(e.endTime)}` : ""}
                      </TableCell>
                      <TableCell>{e.eventName || "Untitled"}</TableCell>
                      <TableCell>{e.eventStatus || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
