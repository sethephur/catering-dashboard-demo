import React, { useEffect, useMemo, useState } from "react";
import EditEventSheet from "@/components/events/EditEventSheet";
import EventRow from "@/components/events/EventRow";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import type { TEvent } from "../shared-types";
import { database } from "../utils/firebaseConfig";
import { useSearchParams } from "react-router-dom";
import { subscribeEvents } from "../data/events";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { updateEvent, deleteEvent } from "../data/events";
import { useNewEventDialog } from "@/providers/new-event-dialog";

const todayYMD = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // YYYY-MM-DD
};

const isOnOrAfter = (ymd: string, ymdRef: string) => {
  // simple string compare works for YYYY-MM-DD
  return ymd >= ymdRef;
};

const ALL_STATUSES = ["unprocessed", "started", "completed"] as const;

const Events: React.FC = () => {
  const [events, setEvents] = useState<TEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { openNewEventDialog } = useNewEventDialog();
  const [searchParams] = useSearchParams();
  const defaultClientId = searchParams.get("clientId") || undefined;

  const [editing, setEditing] = useState<TEvent | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleRequestDelete = (ev: TEvent) => {
    setEditing(ev);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!editing) return;
    try {
      await deleteEvent(database as any, editing.id);
      toast.success("Event deleted", {
        description: editing.eventName || editing.id,
      });
      setConfirmDeleteOpen(false);
      setEditing(null);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Failed to delete event";
      setError(msg);
      toast.error("Delete failed", { description: msg });
    }
  };

  // Filters
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string[]>([]); // empty = all

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsub = subscribeEvents(database, {
      onData: (rows) => {
        setEvents(rows);
        setLoading(false);
      },
      onError: (e) => {
        console.error(e);
        const msg =
          e?.code === "failed-precondition"
            ? "Missing index for ordering by eventDate. Create it in the Firebase console (it usually gives you a link)."
            : e?.message ?? "Failed to load events";
        setError(msg);
        setLoading(false);
      },
    });

    return () => unsub();
  }, [searchParams]);

  const filtered = useMemo(() => {
    const base = events.slice();
    const today = todayYMD();
    return base.filter((e) => {
      const ymd = e.eventDate || "";
      if (showUpcomingOnly && !(ymd && isOnOrAfter(ymd, today))) return false;
      if (statusFilter.length > 0) {
        const s = (e.eventStatus || "").toLowerCase();
        if (!statusFilter.includes(s)) return false;
      }
      return true;
    });
  }, [events, showUpcomingOnly, statusFilter]);

  return (
    <section className="relative mx-auto min-h-screen pt-12">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-balance text-4xl font-bold text-gray-800 dark:text-neutral-50">
          Events
        </h2>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={showUpcomingOnly}
              onCheckedChange={(checked) => setShowUpcomingOnly(!!checked)}
              id="upcoming-only"
            />
            <label
              htmlFor="upcoming-only"
              className="text-sm text-gray-700 dark:text-neutral-200 select-none"
            >
              Upcoming only
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ALL_STATUSES.map((s) => {
              const active = statusFilter.includes(s);
              return (
                <Button
                  key={s}
                  variant={active ? "default" : "secondary"}
                  onClick={() =>
                    setStatusFilter((prev) =>
                      prev.includes(s)
                        ? prev.filter((x) => x !== s)
                        : [...prev, s]
                    )
                  }
                  size="sm"
                  type="button"
                >
                  {s}
                </Button>
              );
            })}
            <Button onClick={() => setStatusFilter([])} size="sm" type="button">
              Clear
            </Button>
            <Button
              onClick={() =>
                openNewEventDialog(
                  defaultClientId ? { defaultClientId } : undefined
                )
              }
            >
              New event
            </Button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          <div className="h-6 w-40 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
          <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
          <div className="h-4 w-10/12 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-800">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-neutral-900">
              <TableRow className="border-b border-gray-200 dark:border-neutral-800">
                <TableHead className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                  Date
                </TableHead>
                <TableHead className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                  Time
                </TableHead>
                <TableHead className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                  Event
                </TableHead>
                <TableHead className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                  Client
                </TableHead>
                <TableHead className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                  Contact
                </TableHead>
                <TableHead className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                  Guests
                </TableHead>
                <TableHead className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-3 py-6 text-sm text-gray-500 dark:text-neutral-400"
                    colSpan={7}
                  >
                    No events yet. Create one from a client profile or the New
                    Event button, and it’ll show up here.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((ev) => (
                  <EventRow
                    key={ev.id}
                    ev={ev}
                    onEdit={(ev) => {
                      setEditing(ev);
                      setEditOpen(true);
                    }}
                    onDelete={(ev) => {
                      handleRequestDelete(ev);
                    }}
                    setEditing={setEditing}
                    setEditOpen={setEditOpen}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <EditEventSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        event={editing}
        statuses={ALL_STATUSES}
        onSave={async (id, updates) => {
          await updateEvent(database as any, id, updates);
          toast.success("Event updated");
          setEditing(null);
        }}
        onDelete={async (id) => {
          await deleteEvent(database as any, id);
          toast.success("Event deleted");
          setEditing(null);
        }}
      />

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The event will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default Events;
