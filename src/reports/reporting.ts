import { saveAs } from "file-saver";
import type { Client, Inquiry, TEvent } from "@/shared-types";
import type { ReportsSourceData } from "@/data/reports";

export type ReportRangePreset = "30d" | "90d" | "365d" | "ytd";

export type ReportDateRange = {
  from: Date;
  to: Date;
};

export type ReportBucket = {
  key: string;
  label: string;
  fullLabel: string;
  inquiries: number;
  events: number;
  clients: number;
  completedEvents: number;
  guests: number;
  estimatedRevenue: number;
  truckEvents: number;
  offsiteEvents: number;
  otherOperations: number;
  basicPackages: number;
  premiumPackages: number;
  otherPackages: number;
};

export type ReportSummary = {
  totalInquiries: number;
  totalEvents: number;
  totalClients: number;
  completedEvents: number;
  totalGuests: number;
  averageGuests: number;
  estimatedRevenue: number;
  inquiryToEventRate: number;
  completionRate: number;
  topOperationLabel: string;
  topPackageLabel: string;
  peakBucketLabel: string;
};

export type ReportAggregation = {
  range: ReportDateRange;
  granularity: "day" | "week" | "month";
  buckets: ReportBucket[];
  summary: ReportSummary;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("en-US");

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const shortMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});

const fullMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

type BucketSeed = Omit<
  ReportBucket,
  | "inquiries"
  | "events"
  | "clients"
  | "completedEvents"
  | "guests"
  | "estimatedRevenue"
  | "truckEvents"
  | "offsiteEvents"
  | "otherOperations"
  | "basicPackages"
  | "premiumPackages"
  | "otherPackages"
>;

const startOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addDays = (value: Date, amount: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
};

const startOfMonth = (value: Date) => {
  const next = new Date(value);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addMonths = (value: Date, amount: number) => {
  const next = new Date(value);
  next.setMonth(next.getMonth() + amount);
  return next;
};

const formatInputDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDayKey = (value: Date) => formatInputDate(value);

const toMonthKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;

const formatDateWindowLabel = (from: Date, to: Date) => {
  if (from.getTime() === to.getTime()) {
    return fullDateFormatter.format(from);
  }
  return `${shortDateFormatter.format(from)} - ${fullDateFormatter.format(to)}`;
};

const getRangeDayCount = (range: ReportDateRange) =>
  Math.floor(
    (startOfDay(range.to).getTime() - startOfDay(range.from).getTime()) / DAY_MS,
  ) + 1;

const getGranularity = (
  range: ReportDateRange,
): ReportAggregation["granularity"] => {
  const days = getRangeDayCount(range);
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
};

const parseDateString = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const parseReportInputDate = (value: string) => {
  if (!value) return null;
  return parseDateString(value);
};

export const getPresetRange = (preset: ReportRangePreset): ReportDateRange => {
  const today = startOfDay(new Date());

  switch (preset) {
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "365d":
      return { from: addDays(today, -364), to: today };
    case "ytd":
      return {
        from: new Date(today.getFullYear(), 0, 1),
        to: today,
      };
    default:
      return { from: addDays(today, -89), to: today };
  }
};

export const normalizeReportRange = (range: ReportDateRange): ReportDateRange => {
  const from = startOfDay(range.from);
  const to = startOfDay(range.to);

  if (from.getTime() <= to.getTime()) {
    return { from, to };
  }

  return { from: to, to: from };
};

export const rangeToInputValues = (range: ReportDateRange) => ({
  from: formatInputDate(range.from),
  to: formatInputDate(range.to),
});

export const formatCurrency = (value: number) => currencyFormatter.format(value);

export const formatInteger = (value: number) => integerFormatter.format(value);

export const formatPercent = (value: number) => `${value.toFixed(1)}%`;

export const formatRangeLabel = (range: ReportDateRange) =>
  `${fullDateFormatter.format(range.from)} - ${fullDateFormatter.format(range.to)}`;

const toMillis = (value: unknown): number | null => {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const next = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(next.getTime()) ? null : next.getTime();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return Number((value as { seconds: number }).seconds) * 1000;
  }

  if (typeof value === "string") {
    const direct = Date.parse(value);
    if (!Number.isNaN(direct)) return direct;

    const fallback = Date.parse(value.replace(/\sat\s/i, " ").replace(/UTC/g, "GMT"));
    return Number.isNaN(fallback) ? null : fallback;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  return null;
};

const getInquiryDate = (inquiry: Inquiry): Date | null => {
  const ms = toMillis(
    inquiry.createdAt ?? inquiry.created_at ?? inquiry.dateCreated,
  );
  return ms ? new Date(ms) : null;
};

const getEventDate = (event: TEvent): Date | null => {
  if (event.eventDate) {
    return parseDateString(event.eventDate);
  }

  const ms = toMillis(event.createdAt);
  return ms ? new Date(ms) : null;
};

const getClientDate = (client: Client): Date | null => {
  const ms = toMillis(client.createdAt ?? client.lastInquiryAt);
  return ms ? new Date(ms) : null;
};

const isWithinRange = (value: Date, range: ReportDateRange) => {
  const ms = value.getTime();
  return ms >= range.from.getTime() && ms <= endOfDay(range.to).getTime();
};

const parseGuestCount = (value: string | null | undefined) => {
  if (!value) return 0;

  const matches = value.match(/\d+/g);
  if (!matches?.length) return 0;

  const numbers = matches.map((entry) => Number.parseInt(entry, 10));
  if (numbers.length >= 2) {
    return Math.round((numbers[0] + numbers[1]) / 2);
  }
  return numbers[0] ?? 0;
};

const parseCurrencyValue = (value: string | null | undefined) => {
  if (!value) return 0;

  const cleaned = value.replace(/[^0-9.-]+/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const classifyOperation = (
  value: string | null | undefined,
): "truckEvents" | "offsiteEvents" | "otherOperations" => {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized.includes("truck")) return "truckEvents";
  if (
    normalized.includes("drop") ||
    normalized.includes("pick") ||
    normalized.includes("delivery") ||
    normalized.includes("cart")
  ) {
    return "offsiteEvents";
  }
  return "otherOperations";
};

const classifyPackage = (
  value: string | null | undefined,
): "basicPackages" | "premiumPackages" | "otherPackages" => {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized.includes("basic")) return "basicPackages";
  if (normalized.includes("premium")) return "premiumPackages";
  return "otherPackages";
};

const estimateEventRevenue = (event: TEvent) => {
  const directRevenue = parseCurrencyValue(event.cost);
  if (directRevenue > 0) return directRevenue;

  const guestCount = parseGuestCount(event.plannedGuestCount);
  const packageKey = classifyPackage(event.package);

  if (packageKey === "premiumPackages") return guestCount * 9;
  if (packageKey === "basicPackages") return guestCount * 7;
  return 0;
};

const createDayBuckets = (range: ReportDateRange) => {
  const buckets: BucketSeed[] = [];
  let cursor = startOfDay(range.from);

  while (cursor.getTime() <= range.to.getTime()) {
    buckets.push({
      key: toDayKey(cursor),
      label: shortDateFormatter.format(cursor),
      fullLabel: fullDateFormatter.format(cursor),
    });
    cursor = addDays(cursor, 1);
  }

  return buckets;
};

const createWeekBuckets = (range: ReportDateRange) => {
  const buckets: BucketSeed[] = [];
  let cursor = startOfDay(range.from);
  let index = 0;

  while (cursor.getTime() <= range.to.getTime()) {
    const bucketEnd = addDays(cursor, 6);
    const clampedEnd =
      bucketEnd.getTime() > range.to.getTime() ? range.to : bucketEnd;

    buckets.push({
      key: `week-${index}`,
      label: `${shortDateFormatter.format(cursor)} - ${shortDateFormatter.format(
        clampedEnd,
      )}`,
      fullLabel: formatDateWindowLabel(cursor, clampedEnd),
    });

    cursor = addDays(clampedEnd, 1);
    index += 1;
  }

  return buckets;
};

const createMonthBuckets = (range: ReportDateRange) => {
  const buckets: BucketSeed[] = [];
  let cursor = startOfMonth(range.from);

  while (cursor.getTime() <= range.to.getTime()) {
    buckets.push({
      key: toMonthKey(cursor),
      label: shortMonthFormatter.format(cursor),
      fullLabel: fullMonthFormatter.format(cursor),
    });
    cursor = addMonths(cursor, 1);
  }

  return buckets;
};

const createBuckets = (
  range: ReportDateRange,
  granularity: ReportAggregation["granularity"],
): ReportBucket[] => {
  const seeds =
    granularity === "day"
      ? createDayBuckets(range)
      : granularity === "week"
      ? createWeekBuckets(range)
      : createMonthBuckets(range);

  return seeds.map((seed) => ({
    ...seed,
    inquiries: 0,
    events: 0,
    clients: 0,
    completedEvents: 0,
    guests: 0,
    estimatedRevenue: 0,
    truckEvents: 0,
    offsiteEvents: 0,
    otherOperations: 0,
    basicPackages: 0,
    premiumPackages: 0,
    otherPackages: 0,
  }));
};

const getBucketKey = (
  value: Date,
  range: ReportDateRange,
  granularity: ReportAggregation["granularity"],
) => {
  if (granularity === "day") return toDayKey(startOfDay(value));
  if (granularity === "month") return toMonthKey(value);

  const diff = Math.floor(
    (startOfDay(value).getTime() - startOfDay(range.from).getTime()) / DAY_MS,
  );
  if (diff < 0) return null;
  return `week-${Math.floor(diff / 7)}`;
};

const toBucketMap = (buckets: ReportBucket[]) =>
  new Map(buckets.map((bucket, index) => [bucket.key, index]));

const topLabel = (
  entries: Array<[label: string, value: number]>,
  fallback: string,
) => {
  const winner = [...entries].sort((left, right) => right[1] - left[1])[0];
  if (!winner || winner[1] <= 0) return fallback;
  return winner[0];
};

export const buildReportAggregation = (
  source: ReportsSourceData,
  selectedRange: ReportDateRange,
): ReportAggregation => {
  const range = normalizeReportRange(selectedRange);
  const granularity = getGranularity(range);
  const buckets = createBuckets(range, granularity);
  const bucketMap = toBucketMap(buckets);

  source.inquiries.forEach((inquiry) => {
    const date = getInquiryDate(inquiry);
    if (!date || !isWithinRange(date, range)) return;

    const key = getBucketKey(date, range, granularity);
    const index = key ? bucketMap.get(key) : undefined;
    if (typeof index === "number") {
      buckets[index].inquiries += 1;
    }
  });

  source.events.forEach((event) => {
    const date = getEventDate(event);
    if (!date || !isWithinRange(date, range)) return;

    const key = getBucketKey(date, range, granularity);
    const index = key ? bucketMap.get(key) : undefined;
    if (typeof index !== "number") return;

    const guestCount = parseGuestCount(event.plannedGuestCount);
    const estimatedRevenue = estimateEventRevenue(event);
    const operationKey = classifyOperation(event.operation);
    const packageKey = classifyPackage(event.package);
    const status = (event.eventStatus ?? "").trim().toLowerCase();

    buckets[index].events += 1;
    buckets[index].guests += guestCount;
    buckets[index].estimatedRevenue += estimatedRevenue;
    buckets[index][operationKey] += 1;
    buckets[index][packageKey] += 1;

    if (status === "completed") {
      buckets[index].completedEvents += 1;
    }
  });

  source.clients.forEach((client) => {
    const date = getClientDate(client);
    if (!date || !isWithinRange(date, range)) return;

    const key = getBucketKey(date, range, granularity);
    const index = key ? bucketMap.get(key) : undefined;
    if (typeof index === "number") {
      buckets[index].clients += 1;
    }
  });

  const totalInquiries = buckets.reduce((sum, bucket) => sum + bucket.inquiries, 0);
  const totalEvents = buckets.reduce((sum, bucket) => sum + bucket.events, 0);
  const totalClients = buckets.reduce((sum, bucket) => sum + bucket.clients, 0);
  const completedEvents = buckets.reduce(
    (sum, bucket) => sum + bucket.completedEvents,
    0,
  );
  const totalGuests = buckets.reduce((sum, bucket) => sum + bucket.guests, 0);
  const estimatedRevenue = buckets.reduce(
    (sum, bucket) => sum + bucket.estimatedRevenue,
    0,
  );

  const summary: ReportSummary = {
    totalInquiries,
    totalEvents,
    totalClients,
    completedEvents,
    totalGuests,
    averageGuests: totalEvents > 0 ? totalGuests / totalEvents : 0,
    estimatedRevenue,
    inquiryToEventRate: totalInquiries > 0 ? (totalEvents / totalInquiries) * 100 : 0,
    completionRate: totalEvents > 0 ? (completedEvents / totalEvents) * 100 : 0,
    topOperationLabel: topLabel(
      [
        ["Truck", buckets.reduce((sum, bucket) => sum + bucket.truckEvents, 0)],
        [
          "Drop-off / pickup",
          buckets.reduce((sum, bucket) => sum + bucket.offsiteEvents, 0),
        ],
        ["Other", buckets.reduce((sum, bucket) => sum + bucket.otherOperations, 0)],
      ],
      "No event mix yet",
    ),
    topPackageLabel: topLabel(
      [
        ["Basic", buckets.reduce((sum, bucket) => sum + bucket.basicPackages, 0)],
        ["Premium", buckets.reduce((sum, bucket) => sum + bucket.premiumPackages, 0)],
        ["Other", buckets.reduce((sum, bucket) => sum + bucket.otherPackages, 0)],
      ],
      "No package mix yet",
    ),
    peakBucketLabel: topLabel(
      buckets.map((bucket) => [bucket.fullLabel, bucket.inquiries] as const),
      "No inquiry peak yet",
    ),
  };

  return { range, granularity, buckets, summary };
};

const escapeCsv = (value: string | number) => {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
};

const fileDateLabel = (value: Date) => formatInputDate(value);

export const exportReportsCsv = (report: ReportAggregation) => {
  const rows: Array<Array<string | number>> = [
    ["Report range", formatRangeLabel(report.range)],
    ["Granularity", report.granularity],
    ["Total inquiries", report.summary.totalInquiries],
    ["Total events", report.summary.totalEvents],
    ["New clients", report.summary.totalClients],
    ["Completed events", report.summary.completedEvents],
    ["Estimated revenue", formatCurrency(report.summary.estimatedRevenue)],
    [],
    [
      "Bucket",
      "Inquiries",
      "Events",
      "New Clients",
      "Completed Events",
      "Guests",
      "Estimated Revenue",
      "Truck Events",
      "Drop-off / Pickup Events",
      "Other Operations",
      "Basic Packages",
      "Premium Packages",
      "Other Packages",
    ],
    ...report.buckets.map((bucket) => [
      bucket.fullLabel,
      bucket.inquiries,
      bucket.events,
      bucket.clients,
      bucket.completedEvents,
      bucket.guests,
      bucket.estimatedRevenue.toFixed(2),
      bucket.truckEvents,
      bucket.offsiteEvents,
      bucket.otherOperations,
      bucket.basicPackages,
      bucket.premiumPackages,
      bucket.otherPackages,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const fileName = `reports-${fileDateLabel(report.range.from)}-to-${fileDateLabel(
    report.range.to,
  )}.csv`;

  saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), fileName);
};

const sanitizePdfText = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const paginateLines = (lines: string[], perPage: number) => {
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += perPage) {
    pages.push(lines.slice(index, index + perPage));
  }

  return pages;
};

const buildPdfBlob = (pages: string[][]) => {
  const objects: string[] = [];
  const catalogId = 1;
  const pagesId = 2;
  const pageIds = pages.map((_, index) => 3 + index * 2);
  const contentIds = pages.map((_, index) => 4 + index * 2);
  const fontId = 3 + pages.length * 2;

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] >>`;

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = contentIds[index];
    const content = [
      "BT",
      "/F1 10 Tf",
      "50 760 Td",
      "14 TL",
      ...page.map((line, lineIndex) =>
        lineIndex === 0
          ? `(${sanitizePdfText(line)}) Tj`
          : `T* (${sanitizePdfText(line)}) Tj`,
      ),
      "ET",
    ].join("\n");

    objects[pageId] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets = new Array(objects.length).fill(0);

  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
};

export const exportReportsPdf = (report: ReportAggregation) => {
  const lines = [
    REPORT_EXPORT_TITLE,
    `Range: ${formatRangeLabel(report.range)}`,
    `Granularity: ${report.granularity}`,
    "",
    "Summary",
    `Total inquiries: ${formatInteger(report.summary.totalInquiries)}`,
    `Total events: ${formatInteger(report.summary.totalEvents)}`,
    `New clients: ${formatInteger(report.summary.totalClients)}`,
    `Completed events: ${formatInteger(report.summary.completedEvents)}`,
    `Average guests per event: ${report.summary.averageGuests.toFixed(1)}`,
    `Estimated revenue: ${formatCurrency(report.summary.estimatedRevenue)}`,
    `Inquiry to event rate: ${formatPercent(report.summary.inquiryToEventRate)}`,
    `Completion rate: ${formatPercent(report.summary.completionRate)}`,
    `Top operation mix: ${report.summary.topOperationLabel}`,
    `Top package mix: ${report.summary.topPackageLabel}`,
    `Peak inquiry period: ${report.summary.peakBucketLabel}`,
    "",
    "Trend Snapshot",
    ...report.buckets.flatMap((bucket) => [
      `${bucket.fullLabel}`,
      `  Inquiries ${formatInteger(bucket.inquiries)} | Events ${formatInteger(bucket.events)} | Clients ${formatInteger(bucket.clients)}`,
      `  Guests ${formatInteger(bucket.guests)} | Revenue ${formatCurrency(bucket.estimatedRevenue)}`,
    ]),
    "",
    "PDF note: This export is data-first and does not embed live chart graphics.",
  ];

  const blob = buildPdfBlob(paginateLines(lines, 42));
  const fileName = `reports-${fileDateLabel(report.range.from)}-to-${fileDateLabel(
    report.range.to,
  )}.pdf`;

  saveAs(blob, fileName);
};
import { REPORT_EXPORT_TITLE } from "@/config/appInfo";
