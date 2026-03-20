import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "../components/ui/sheet";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "../components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Textarea } from "../components/ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "../components/ui/form";
import { IconUserCircle } from "@tabler/icons-react";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { database } from "../utils/firebaseConfig";
import { clientSchema } from "../shared-types";
import { eventSchema } from "../shared-types";
import {
  createClientProfile,
  deleteClientProfile,
  subscribeClients,
  updateClientProfile,
} from "@/data/clients";
import { createEvent } from "@/data/events";
import normalizePhoneE164 from "../utils/phoneUtils";
import { useNavigate } from "react-router-dom";
import { useNewEventDialog } from "@/providers/new-event-dialog";

type Client = {
  id: string;
  firstName: string;
  lastName: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

const clientFormSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    company: z.string().trim().optional().nullable(),
    email: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v && v.trim() === "" ? null : v))
      .refine((v) => !v || /.+@.+\..+/.test(v), {
        message: "Invalid email address",
      }),
    phone: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v && v.trim() === "" ? null : v))
      .superRefine((val, ctx) => {
        if (!val) return;
        const e164 = normalizePhoneE164(val);
        if (!e164) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid phone number",
          });
        }
      }),
    notes: z.string().trim().optional().nullable(),
  })
  .transform((v) => ({
    ...v,
    phone: normalizePhoneE164(v.phone as any),
    email: v.email ? String(v.email).trim() : null,
    company: v.company ? String(v.company).trim() : null,
    notes: v.notes ? String(v.notes).trim() : null,
  }));

// RHF <-> Zod input/output alignment
type ClientFormIn = z.input<typeof clientFormSchema>;
type ClientFormOut = z.output<typeof clientFormSchema>;

// Event form schema
const eventFormSchema = eventSchema.omit({ id: true }).transform((v) => ({
  ...v,
  siteContact: String(v.siteContact ?? "").trim(),
  eventDate: String(v.eventDate ?? "").trim(),
  startTime: String(v.startTime ?? "").trim(),
  endTime: String(v.endTime ?? "").trim(),
  siteAddress: String(v.siteAddress ?? "").trim(),
  phoneNumber: normalizePhoneE164(v.phoneNumber) ?? "",
  plannedGuestCount: String(v.plannedGuestCount ?? "").trim(),
  operation: v.operation ? String(v.operation).trim() : null,
  package: v.package ? String(v.package).trim() : null,
  eventName: v.eventName ? String(v.eventName).trim() : null,
  notes: String(v.notes ?? "").trim(),
  cost: String(v.cost ?? "").trim(),
  eventStatus: v.eventStatus ? String(v.eventStatus).trim() : null,
}));

type EventFormIn = z.input<typeof eventFormSchema>;
type EventFormOut = z.output<typeof eventFormSchema>;

export default function Clients() {
  const navigate = useNavigate();
  const { openNewEventDialog } = useNewEventDialog();
  // Real data state
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);

  // New Client form (react-hook-form)
  const newForm = useForm<ClientFormIn, any, ClientFormOut>({
    resolver: zodResolver<ClientFormIn, any, ClientFormOut>(clientFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      company: "",
      email: "",
      phone: "",
      notes: "",
    },
  });

  // Edit Client form
  const editForm = useForm<ClientFormIn, any, ClientFormOut>({
    resolver: zodResolver<ClientFormIn, any, ClientFormOut>(clientFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      company: "",
      email: "",
      phone: "",
      notes: "",
    },
  });

  const fullName = (c: Client) => `${c.firstName} ${c.lastName}`.trim();
  const [eventOpen, setEventOpen] = useState(false);
  const [eventClient, setEventClient] = useState<Client | null>(null);

  // Event form
  const eventForm = useForm<EventFormIn, any, EventFormOut>({
    resolver: zodResolver<EventFormIn, any, EventFormOut>(eventFormSchema),
    defaultValues: {
      siteContact: "",
      eventDate: "",
      startTime: "",
      endTime: "",
      siteAddress: "",
      phoneNumber: "",
      plannedGuestCount: "",
      operation: "",
      package: "",
      eventName: "",
      notes: "",
      cost: "",
      eventStatus: "",
    },
  });

  const sorted = useMemo(
    () => [...clients].sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [clients]
  );

  // 🔽 realtime: subscribe to clients on mount
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeClients(
      (rows) => {
        try {
          const parsed = z.array(clientSchema).safeParse(rows);
          const validated = parsed.success ? parsed.data : rows;
          const normalized: Client[] = validated.map((c: any) => ({
            id: String(c.id ?? ""),
            firstName: String(c.firstName ?? "").trim(),
            lastName: String(c.lastName ?? "").trim(),
            company:
              c.company != null && String(c.company).trim() !== ""
                ? String(c.company)
                : null,
            email:
              c.email != null && String(c.email).trim() !== ""
                ? String(c.email)
                : null,
            phone:
              c.phone != null && String(c.phone).trim() !== ""
                ? String(c.phone)
                : null,
            notes:
              c.notes != null && String(c.notes).trim() !== ""
                ? String(c.notes)
                : null,
          }));
          setClients(normalized);
          setError(null);
        } catch (e: any) {
          console.error("Failed to load clients:", e);
          setError(e?.message ?? "Failed to load clients");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("Realtime clients error:", err);
        setError((err as any)?.message ?? "Realtime update error");
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // Handlers
  const openEdit = (c: Client) => {
    setEditing(c);
    editForm.reset({
      firstName: c.firstName,
      lastName: c.lastName,
      company: c.company ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      notes: c.notes ?? "",
    });
    setEditOpen(true);
  };

  const onSubmitNew = async (values: ClientFormOut) => {
    const email = values.email || null;
    const emailNormalized = email ? email.toLowerCase() : null;
    const phoneNormalized = values.phone || null;
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      company: values.company || null,
      email,
      phone: values.phone || null,
      phoneNormalized,
      notes: values.notes || null,
      emails: email ? [email] : [],
      emailsNormalized: emailNormalized ? [emailNormalized] : [],
      inquiryIds: [],
    };

    try {
      await createClientProfile({
        ...payload,
        events: null,
        lastInquiryAt: undefined,
        updatedAt: undefined,
      });
      newForm.reset();
      setNewOpen(false);
    } catch (e) {
      console.error("Failed to create client:", e);
      setError((e as any)?.message ?? "Failed to create client");
    }
  };

  const onSubmitEdit = async (values: ClientFormOut) => {
    if (!editing) return;

    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      company: values.company || null,
      email: values.email || null,
      phone: values.phone || null,
      phoneNormalized: values.phone || null,
      notes: values.notes || null,
    };

    try {
      await updateClientProfile(editing.id, payload as any);
      setEditOpen(false);
      setEditing(null);
    } catch (e) {
      console.error("Failed to update client:", e);
      setError((e as any)?.message ?? "Failed to update client");
    }
  };

  const onSubmitEvent = async (values: EventFormOut) => {
    if (!eventClient) return;

    try {
      // Create top-level event linked to this client
      const payload = {
        // linkage
        clientId: eventClient.id,
        clientRef: null,
        clientName: fullName(eventClient), // denorm for listings

        // event fields (normalized to your schema expectations)
        siteContact: String(values.siteContact || "").trim(),
        eventDate: String(values.eventDate || "").trim(), // YYYY-MM-DD
        startTime: String(values.startTime || "").trim(), // HH:MM
        endTime: String(values.endTime || "").trim(),
        siteAddress: String(values.siteAddress || "").trim(),
        phoneNumber: String(values.phoneNumber || "").trim(),
        plannedGuestCount: String(values.plannedGuestCount || "").trim(),
        operation: values.operation ? String(values.operation).trim() : null,
        package: values.package ? String(values.package).trim() : null,
        eventName: values.eventName ? String(values.eventName).trim() : null,
        notes: String(values.notes || "").trim(),
        cost: String(values.cost || "").trim(),
        eventStatus: values.eventStatus
          ? String(values.eventStatus).trim()
          : "unprocessed",

      };

      await createEvent(database as any, payload as any);

      // Reset UI
      setEventOpen(false);
      setEventClient(null);
      eventForm.reset();
      setError(null);
    } catch (e) {
      console.error("Failed to create event:", e);
      setError((e as any)?.message ?? "Failed to create event");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteClientProfile(pendingDelete.id);
      setPendingDelete(null);
    } catch (e) {
      console.error("Failed to delete client:", e);
      setError((e as any)?.message ?? "Failed to delete client");
    }
  };

  // Opens the event dialog prefilled for a client, no DB writes
  return (
    <>
      <section className="relative mx-auto min-h-screen pt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-balance text-4xl font-bold text-gray-800 dark:text-neutral-50">
            Clients
          </h2>

          {/* New Client */}
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button className="button-primary">
                <IconUserCircle /> New Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create client</DialogTitle>
                <DialogDescription>
                  Minimal details are fine; you can edit later.
                </DialogDescription>
              </DialogHeader>

              <Form {...newForm}>
                <form
                  className="grid gap-4"
                  onSubmit={newForm.handleSubmit(onSubmitNew)}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      control={newForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First name</FormLabel>
                          <FormControl>
                            <Input id="nf-first" autoFocus {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={newForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last name</FormLabel>
                          <FormControl>
                            <Input id="nf-last" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      control={newForm.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company</FormLabel>
                          <FormControl>
                            <Input id="nf-company" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={newForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input id="nf-email" type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      control={newForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input id="nf-phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={newForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea id="nf-notes" rows={3} {...field} />
                          </FormControl>
                          <FormDescription>
                            Anything helpful to remember.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <DialogFooter className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNewOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {loading && (
          <div className="mb-4 text-sm text-muted-foreground">
            Loading clients…
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Grid of clients */}
        {!loading && sorted.length === 0 ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            No clients found. Use{" "}
            <span className="font-medium">New Client</span> to add your first
            one.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((c) => (
              <ContextMenu key={c.id}>
                <ContextMenuTrigger asChild>
                  <Card
                    className="cursor-pointer transition hover:shadow-md"
                    onClick={() => navigate(`/clients/${c.id}`)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{fullName(c)}</span>
                        {c.company && (
                          <span className="text-sm font-normal text-muted-foreground">
                            {c.company}
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm text-muted-foreground">
                      {c.email && <div>Email: {c.email}</div>}
                      {c.phone && <div>Phone: {c.phone}</div>}
                      {c.notes && c.notes.trim() !== "" && (
                        <div>Notes: {c.notes}</div>
                      )}
                    </CardContent>
                  </Card>
                </ContextMenuTrigger>

                <ContextMenuContent>
                  <ContextMenuItem onClick={() => openEdit(c)}>
                    Edit client
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() =>
                      openNewEventDialog({ defaultClientId: c.id })
                    }
                  >
                    Add event
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setPendingDelete(c)}
                  >
                    Delete client…
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        )}
      </section>

      {/* New Event Dialog */}
      <Dialog open={eventOpen} onOpenChange={setEventOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              New event for{" "}
              {eventClient
                ? `${eventClient.firstName} ${eventClient.lastName}`
                : "client"}
            </DialogTitle>
            <DialogDescription>
              Phone will be saved in E.164 format.
            </DialogDescription>
          </DialogHeader>

          <Form {...eventForm}>
            <form
              className="grid gap-4"
              onSubmit={eventForm.handleSubmit(onSubmitEvent)}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={eventForm.control}
                  name="siteContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site contact</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="eventName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField
                  control={eventForm.control}
                  name="eventDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input placeholder="YYYY-MM-DD" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start</FormLabel>
                      <FormControl>
                        <Input placeholder="HH:MM" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End</FormLabel>
                      <FormControl>
                        <Input placeholder="HH:MM" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={eventForm.control}
                  name="siteAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 555-5555" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField
                  control={eventForm.control}
                  name="plannedGuestCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guests</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="eventStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., scheduled" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid">
                <FormField
                  control={eventForm.control}
                  name="operation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operation</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={eventForm.control}
                  name="package"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEventOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create event</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full max-w-xl sm:w-[480px]">
          <SheetHeader>
            <SheetTitle>Edit client</SheetTitle>
            <SheetDescription>Update client details.</SheetDescription>
          </SheetHeader>

          <Form {...editForm}>
            <form
              className="mt-4 grid gap-4"
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={editForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input id="ef-first" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input id="ef-last" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={editForm.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input id="ef-company" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input id="ef-email" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={editForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input id="ef-phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea id="ef-notes" rows={4} {...field} />
                      </FormControl>
                      <FormDescription>Internal only.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <SheetFooter className="mt-6">
                <SheetClose asChild>
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </SheetClose>
                <Button type="submit">Save</Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <span className="font-medium">
                {pendingDelete ? fullName(pendingDelete) : "this client"}
              </span>{" "}
              from your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="cursor-pointer"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-accent hover:bg-destructive/90 cursor-pointer"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
