import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressAutofill } from "@/components/AddressAutofill";
import type { TEvent } from "@/shared-types";

export type EditEventSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TEvent | null;
  statuses?: readonly string[];
  onSave: (id: string, updates: Partial<TEvent>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const toNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const editSchema = z
  .object({
    eventName: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform(toNull as any),
    eventDate: z.string().trim().min(1, "Date is required"),
    startTime: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform(toNull as any),
    endTime: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform(toNull as any),
    siteAddress: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform(toNull as any),
    siteContact: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform(toNull as any),
    plannedGuestCount: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform(toNull as any),
    eventStatus: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform(toNull as any),
    notes: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform(toNull as any),
  })
  .transform((v) => ({
    ...v,
    eventName: v.eventName ?? undefined,
    startTime: v.startTime ?? undefined,
    endTime: v.endTime ?? undefined,
    siteAddress: v.siteAddress ?? undefined,
    siteContact: v.siteContact ?? undefined,
    plannedGuestCount: v.plannedGuestCount ?? undefined,
    eventStatus: v.eventStatus ?? undefined,
    notes: v.notes ?? undefined,
  }));

type EditIn = z.input<typeof editSchema>;
type EditOut = z.output<typeof editSchema>;

export default function EditEventSheet({
  open,
  onOpenChange,
  event,
  statuses = ["unprocessed", "started", "completed"],
  onSave,
  onDelete,
}: EditEventSheetProps) {
  const form = useForm<EditIn, any, EditOut>({
    resolver: zodResolver<EditIn, any, EditOut>(editSchema),
    defaultValues: {
      eventName: "",
      eventDate: "",
      startTime: "",
      endTime: "",
      siteAddress: "",
      siteContact: "",
      plannedGuestCount: "",
      eventStatus: "",
      notes: "",
    },
  });

  React.useEffect(() => {
    if (open && event) {
      form.reset({
        eventName: event.eventName || "",
        eventDate: event.eventDate || "",
        startTime: event.startTime || "",
        endTime: event.endTime || "",
        siteAddress: event.siteAddress || "",
        siteContact: event.siteContact || "",
        plannedGuestCount: event.plannedGuestCount || "",
        eventStatus: event.eventStatus || "",
        notes: event.notes || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  const submitting = form.formState.isSubmitting;

  const handleSubmit = async (values: EditOut) => {
    if (!event) return;
    await onSave(event.id, values as Partial<TEvent>);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit Event</SheetTitle>
          <SheetDescription>Make changes and save.</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="mt-4 grid grid-cols-1 gap-3"
          >
            <FormField
              control={form.control}
              name="eventName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="siteAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <AddressAutofill
                      value={field.value || ""}
                      onChange={field.onChange}
                      onSelected={field.onChange}
                    />
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
                  <FormLabel>Event Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
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
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="siteContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site Contact</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                    <FormLabel>Planned Guest Count</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="eventStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
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

            <SheetFooter>
              <div className="mt-2 flex w-full items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  Save Changes
                </Button>
                {event && (
                  <Button
                    type="button"
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => onDelete(event.id)}
                    disabled={submitting}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
