import { z } from "zod";

export const inquiryStatusSchema = z.enum(["unprocessed", "completed"]);
export type InquiryStatus = z.infer<typeof inquiryStatusSchema>;

export const helpTicketStatusSchema = z.enum([
  "open",
  "in_progress",
  "pending_requester",
  "closed",
]);
export type HelpTicketStatus = z.infer<typeof helpTicketStatusSchema>;

export const helpTicketMessageSchema = z.object({
  id: z.string(),
  authorType: z.enum(["requester", "support"]),
  authorName: z.string().nullable().optional(),
  body: z.string(),
  createdAt: z.unknown().optional().nullable(),
});
export type HelpTicketMessage = z.infer<typeof helpTicketMessageSchema>;

export const helpTicketSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  locationHint: z.string().nullable().optional(),
  message: z.string(),
  status: helpTicketStatusSchema,
  source: z.string().nullable().optional(),
  lastMessagePreview: z.string().nullable().optional(),
  lastResponderType: z.enum(["requester", "support"]).nullable().optional(),
  createdAt: z.unknown().optional().nullable(),
  updatedAt: z.unknown().optional().nullable(),
  lastMessageAt: z.unknown().optional().nullable(),
});
export type HelpTicket = z.infer<typeof helpTicketSchema>;

export const inquirySchema = z.object({
  // treat numeric id as optional; prefer Firestore doc.id in code
  id: z.coerce.number().optional(),
  inquiryNumber: z.coerce.number().optional().nullable(),
  docId: z.string().nullable(),
  createdAt: z.unknown().optional().nullable(),
  created_at: z.unknown().optional().nullable(),
  dateCreated: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  company: z.string(),
  eventDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  siteAddress: z.string(),
  email: z.string(),
  phoneNumber: z.string(),
  plannedGuestCount: z.string(),
  operation: z.string().nullable(),
  package: z.string().nullable(),
  eventName: z.string().nullable().optional(),
  reference: z.string(),
  notes: z.string(),
  // Legacy "started" values are normalized to "unprocessed" at parse time.
  status: z.preprocess(
    (value) => (value === "started" ? "unprocessed" : value),
    inquiryStatusSchema.nullish()
  ),
  clientId: z.string().nullable().optional(), // set by function
  emailNormalized: z.string().nullable().optional(), // lowercase/trim of email
  phoneNormalized: z.string().nullable().optional(),
  matchStatus: z
    .enum(["linked", "ambiguous_match", "manual_override", "no_match"])
    .optional()
    .nullable(),
  matchCandidates: z.array(z.string()).optional().nullable(),
});
export type Inquiry = z.infer<typeof inquirySchema>;

export const eventSchema = z.object({
  id: z.string(),
  clientId: z.string().nullable().optional(),
  clientName: z.string().nullable().optional(),
  clientRef: z.unknown().optional().nullable(),
  sourceInquiryId: z.string().nullable().optional(),
  siteContact: z.string(),
  eventDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  siteAddress: z.string(),
  phoneNumber: z.string(),
  plannedGuestCount: z.string(),
  operation: z.string().nullable(),
  package: z.string().nullable(),
  eventName: z.string().nullable().optional(),
  notes: z.string(),
  cost: z.string(),
  eventStatus: z.string().nullable().optional(),
  createdAt: z.unknown().optional().nullable(),
  updatedAt: z.unknown().optional().nullable(),
});
export type TEvent = z.infer<typeof eventSchema>;

export const clientSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  company: z.string(),
  email: z.string(),
  phone: z.string(),
  phoneNormalized: z.string().optional().nullable(),
  events: z.array(z.number()).nullable(),
  emails: z.array(z.string()).default([]), // as-entered (primary + alternates)
  emailsNormalized: z.array(z.string()).default([]), // lowercase/trim set
  inquiryIds: z.array(z.string()).default([]), // denormalized list, maintained by function
  lastInquiryAt: z.string().optional(),
  createdAt: z.unknown().optional().nullable(),
  updatedAt: z.unknown().optional().nullable(),
});
export type Client = z.infer<typeof clientSchema>;
