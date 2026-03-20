import { z } from 'zod';

export const inquirySchema = z.object({
  id: z.number(),
  EventDate: z.string(),
  clientname: z.string(),
  date: z.string(),
  email: z.string(),
  endtime: z.string(),
  firstname: z.string(),
  lastname: z.string(),
  notes: z.string(),
  operation: z.string().nullable(),
  plannedGuestCount: z.string(),
  reference: z.string(),
  siteaddress: z.string(),
  starttime: z.string(),
  telnumber: z.string(),
  theme: z.string(),
});

const shape = {
  name: 'Jon',
};

const a = inquirySchema.parse({
  id: 1,
  EventDate: 'your mom',
  clientname: 'lolol',
  date: 'yay',
  email: 'jon@example.com',
  endtime: 'end time',
  firstname: 'first name',
  lastname: 'last name',
  notes: 'notes',
  operation: 'operation',
  plannedGuestCount: 'planned guest',
  reference: 'referenced',
  siteaddress: 'site address',
  starttime: 'sodijfoisdfj',
  telnumber: '209384098',
  theme: 'dark',
});
