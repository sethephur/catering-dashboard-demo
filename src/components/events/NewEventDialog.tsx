import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

type DialogClient = {
  id: string;
  name: string;
  company?: string;
};

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ChevronDownIcon } from "lucide-react";
import { format } from "date-fns";
import Calendar16 from "../ui/calendar-16";

export type NewEventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: DialogClient[];
  clientsLoading?: boolean;
  onCreate: (payload: {
    clientId?: string | null;
    eventName?: string | null;
    eventDate: string;
    startTime?: string;
    endTime?: string;
    siteAddress?: string;
    siteContact?: string;
    plannedGuestCount?: string;
    notes?: string;
  }) => Promise<void>;
  defaultClientId?: string; // from search params
  clientSelectionOptional?: boolean;
  initialValues?: Partial<{
    eventName: string | null;
    eventDate: string;
    startTime: string | null;
    endTime: string | null;
    siteAddress: string | null;
    siteContact: string | null;
    plannedGuestCount: string | null;
    notes: string | null;
  }>;
};

// --- Schema ---------------------------------------------------------------
const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const eventFormSchema = z.object({
  clientId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform(emptyToNull as any),
  eventName: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform(emptyToNull as any),
  eventDate: z
    .string()
    .trim()
    .min(1, "Date is required")
    .refine((s) => /\d{4}-\d{2}-\d{2}/.test(s), { message: "Use YYYY-MM-DD" }),
  startTime: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform(emptyToNull as any),
  endTime: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform(emptyToNull as any),
  siteAddress: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform(emptyToNull as any),
  siteContact: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform(emptyToNull as any),
  plannedGuestCount: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform(emptyToNull as any),
  notes: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform(emptyToNull as any),
});

type EventForm = z.infer<typeof eventFormSchema>;

// --- Component ------------------------------------------------------------
export function NewEventDialog({
  open,
  onOpenChange,
  clients,
  clientsLoading,
  onCreate,
  defaultClientId,
  clientSelectionOptional = false,
  initialValues,
}: NewEventDialogProps) {
  const form = useForm<EventForm, any, EventForm>({
    resolver: zodResolver<EventForm, any, EventForm>(eventFormSchema),
    defaultValues: {
      clientId: defaultClientId || "",
      eventName: initialValues?.eventName ?? "",
      eventDate: initialValues?.eventDate ?? "",
      startTime: initialValues?.startTime ?? "",
      endTime: initialValues?.endTime ?? "",
      siteAddress: initialValues?.siteAddress ?? "",
      siteContact: initialValues?.siteContact ?? "",
      plannedGuestCount: initialValues?.plannedGuestCount ?? "",
      notes: initialValues?.notes ?? "",
    },
  });
  const [openCalendar, setOpenCalendar] = React.useState(false);

  // Reset pre-selected client whenever dialog opens with a new defaultClientId
  React.useEffect(() => {
    if (open) {
      const firstClientId =
        defaultClientId ||
        (clientSelectionOptional ? "" : clients[0]?.id || "");
      form.reset({
        clientId: firstClientId,
        eventName: initialValues?.eventName ?? "",
        eventDate: initialValues?.eventDate ?? "",
        startTime: initialValues?.startTime ?? "",
        endTime: initialValues?.endTime ?? "",
        siteAddress: initialValues?.siteAddress ?? "",
        siteContact: initialValues?.siteContact ?? "",
        plannedGuestCount: initialValues?.plannedGuestCount ?? "",
        notes: initialValues?.notes ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultClientId, clientSelectionOptional, initialValues]);

  const submitting = form.formState.isSubmitting;

  // Mirror form values into the calendar widget and write changes back to form
  const watchedEventDate = form.watch("eventDate");
  const watchedStartTime = form.watch("startTime");
  const watchedEndTime = form.watch("endTime");

  const dateFromForm: Date | undefined = (() => {
    if (!watchedEventDate) return undefined;
    // Expecting YYYY-MM-DD; construct a Date safely
    const [y, m, d] = watchedEventDate.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d);
  })();

  const handleDateChange = (d?: Date) => {
    if (!d) {
      form.setValue("eventDate", "", { shouldValidate: true, shouldDirty: true });
      return;
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    form.setValue("eventDate", `${yyyy}-${mm}-${dd}`, { shouldValidate: true, shouldDirty: true });
  };

  const handleStartTimeChange = (t: string) => {
    form.setValue("startTime", t, { shouldValidate: false, shouldDirty: true });
  };

  const handleEndTimeChange = (t: string) => {
    form.setValue("endTime", t, { shouldValidate: false, shouldDirty: true });
  };

  const onSubmit = async (values: EventForm) => {
    if (!clientSelectionOptional && !values.clientId) {
      form.setError("clientId", {
        type: "manual",
        message: "Client is required",
      });
      return;
    }

    const trimOrU = (s?: string | null) =>
      s && s.trim() ? s.trim() : undefined;
    await onCreate({
      clientId: values.clientId ?? undefined,
      eventDate: values.eventDate,
      eventName:
        values.eventName === null
          ? null
          : trimOrU(values.eventName || undefined),
      startTime: trimOrU(values.startTime || undefined),
      endTime: trimOrU(values.endTime || undefined),
      siteAddress: trimOrU(values.siteAddress || undefined),
      siteContact: trimOrU(values.siteContact || undefined),
      plannedGuestCount: trimOrU(values.plannedGuestCount || undefined),
      notes: trimOrU(values.notes || undefined),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription>Fill out the event details.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
            {/* Client selector */}
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <FormControl>
                    <Select
                      disabled={!!clientsLoading}
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            clientsLoading
                              ? "Loading clients…"
                              : "Select a client"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {clientsLoading ? (
                          <SelectItem key="loading" value="__loading__" disabled>
                            Loading clients…
                          </SelectItem>
                        ) : clients.length === 0 ? (
                          <SelectItem key="empty" value="__empty__" disabled>
                            No clients found
                          </SelectItem>
                        ) : (
                          clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                              {c.company ? ` — ${c.company}` : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="eventName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event name (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Spring Gala" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="eventDate" className="px-1">
                        Date & Time
                      </FormLabel>
                    <Popover open={openCalendar} onOpenChange={setOpenCalendar}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          id="date-picker"
                          className="w-40 justify-between font-normal"
                          type="button"
                        >
                          {field.value
                            ? (() => {
                                try {
                                  const [y, m, dnum] = field.value.split("-").map(Number);
                                  const d = y && m && dnum ? new Date(y, m - 1, dnum) : new Date(NaN);
                                  return isNaN(d.getTime())
                                    ? "Select date"
                                    : format(d, "PPP");
                                } catch {
                                  return "Select date";
                                }
                              })()
                            : "Select date"}
                          <ChevronDownIcon />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="start"
                      >
                        <Calendar16
                          date={dateFromForm}
                          onDateChange={handleDateChange}
                          startTime={watchedStartTime || ""}
                          endTime={watchedEndTime || ""}
                          onStartTimeChange={handleStartTimeChange}
                          onEndTimeChange={handleEndTimeChange}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start time (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="HH:MM" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End time (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="HH:MM" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="siteAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site address (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St, City" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="siteContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site contact (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Name of on-site contact" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plannedGuestCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guests (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 120" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Any extra details"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create event"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default NewEventDialog;
