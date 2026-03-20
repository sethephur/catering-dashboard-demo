import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, FileText, RefreshCw } from "lucide-react";
import { fetchReportsSourceData, type ReportsSourceData } from "@/data/reports";
import { ReportAreaCard, type ReportAreaDatum } from "@/components/reports/ReportAreaCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  buildReportAggregation,
  exportReportsCsv,
  exportReportsPdf,
  formatCurrency,
  formatInteger,
  formatPercent,
  formatRangeLabel,
  getPresetRange,
  normalizeReportRange,
  parseReportInputDate,
  rangeToInputValues,
  type ReportAggregation,
  type ReportRangePreset,
} from "@/reports/reporting";

const presetButtons: Array<{ key: ReportRangePreset; label: string }> = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "365d", label: "Last 12 months" },
  { key: "ytd", label: "Year to date" },
];

const summaryCardTone = [
  "from-amber-400/15 via-background to-background",
  "from-cyan-400/15 via-background to-background",
  "from-emerald-400/15 via-background to-background",
  "from-rose-400/15 via-background to-background",
  "from-indigo-400/15 via-background to-background",
  "from-orange-400/15 via-background to-background",
];

const chartRowsFromReport = (
  report: ReportAggregation,
  select: (bucket: ReportAggregation["buckets"][number]) => Record<string, number>,
): ReportAreaDatum[] =>
  report.buckets.map((bucket) => ({
    label: bucket.label,
    fullLabel: bucket.fullLabel,
    ...select(bucket),
  }));

export default function Reports() {
  const initialRange = useMemo(() => getPresetRange("90d"), []);
  const initialInputs = useMemo(() => rangeToInputValues(initialRange), [initialRange]);

  const [fromInput, setFromInput] = useState(initialInputs.from);
  const [toInput, setToInput] = useState(initialInputs.to);
  const [sourceData, setSourceData] = useState<ReportsSourceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRange = useMemo(() => {
    const parsedFrom = parseReportInputDate(fromInput) ?? initialRange.from;
    const parsedTo = parseReportInputDate(toInput) ?? initialRange.to;
    return normalizeReportRange({ from: parsedFrom, to: parsedTo });
  }, [fromInput, initialRange.from, initialRange.to, toInput]);

  const loadReports = async (showRefreshState: boolean) => {
    if (showRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const next = await fetchReportsSourceData();
      setSourceData(next);
      setError(null);
    } catch (caught) {
      console.error("[reports] Failed to load source data", caught);
      const message =
        caught instanceof Error ? caught.message : "Failed to load report data.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadReports(false);
  }, []);

  const report = useMemo(
    () => (sourceData ? buildReportAggregation(sourceData, selectedRange) : null),
    [selectedRange, sourceData],
  );

  const summaryCards = useMemo(() => {
    if (!report) return [];

    return [
      {
        label: "Inquiries in range",
        value: formatInteger(report.summary.totalInquiries),
        detail: `Highest activity: ${report.summary.peakBucketLabel}`,
      },
      {
        label: "Scheduled events",
        value: formatInteger(report.summary.totalEvents),
        detail: `${formatPercent(report.summary.inquiryToEventRate)} conversion from inquiries`,
      },
      {
        label: "New clients",
        value: formatInteger(report.summary.totalClients),
        detail: `${formatPercent(report.summary.completionRate)} event completion rate`,
      },
      {
        label: "Average guests",
        value: report.summary.averageGuests.toFixed(1),
        detail: `${formatInteger(report.summary.totalGuests)} total guests`,
      },
      {
        label: "Estimated revenue",
        value: formatCurrency(report.summary.estimatedRevenue),
        detail: `Top package mix: ${report.summary.topPackageLabel}`,
      },
      {
        label: "Top service mix",
        value: report.summary.topOperationLabel,
        detail: `Range: ${formatRangeLabel(report.range)}`,
      },
    ];
  }, [report]);

  const inquiryData = useMemo(
    () => (report ? chartRowsFromReport(report, (bucket) => ({ inquiries: bucket.inquiries })) : []),
    [report],
  );

  const eventData = useMemo(
    () => (report ? chartRowsFromReport(report, (bucket) => ({ events: bucket.events })) : []),
    [report],
  );

  const clientData = useMemo(
    () => (report ? chartRowsFromReport(report, (bucket) => ({ clients: bucket.clients })) : []),
    [report],
  );

  const comparisonData = useMemo(
    () =>
      report
        ? chartRowsFromReport(report, (bucket) => ({
            inquiries: bucket.inquiries,
            events: bucket.events,
            clients: bucket.clients,
          }))
        : [],
    [report],
  );

  const operationsMixData = useMemo(
    () =>
      report
        ? chartRowsFromReport(report, (bucket) => ({
            truckEvents: bucket.truckEvents,
            offsiteEvents: bucket.offsiteEvents,
            otherOperations: bucket.otherOperations,
          }))
        : [],
    [report],
  );

  const packagesMixData = useMemo(
    () =>
      report
        ? chartRowsFromReport(report, (bucket) => ({
            basicPackages: bucket.basicPackages,
            premiumPackages: bucket.premiumPackages,
            otherPackages: bucket.otherPackages,
          }))
        : [],
    [report],
  );

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 pt-8">
      <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-amber-400/12 via-background to-background shadow-sm">
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
              Reports
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">Operations reports</CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-6">
                Track inquiry volume, event activity, client growth, and service mix
                from one reporting view. All charts reflect live workspace data for the
                selected date range.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => report && exportReportsCsv(report)}
              disabled={!report || loading || refreshing}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={() => report && exportReportsPdf(report)}
              disabled={!report || loading || refreshing}
            >
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/60">
          <div>
            <CardTitle>Date range</CardTitle>
            <CardDescription>
              Set the reporting window, then export the same view as CSV or PDF.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {presetButtons.map((preset) => {
              const range = rangeToInputValues(getPresetRange(preset.key));
              const isActive = fromInput === range.from && toInput === range.to;
              return (
                <Button
                  key={preset.key}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "secondary"}
                  onClick={() => {
                    setFromInput(range.from);
                    setToInput(range.to);
                  }}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Start date</span>
            <Input
              type="date"
              value={fromInput}
              onChange={(event) => setFromInput(event.target.value)}
              max={toInput}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">End date</span>
            <Input
              type="date"
              value={toInput}
              onChange={(event) => setToInput(event.target.value)}
              min={fromInput}
            />
          </label>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 md:w-auto"
              disabled={loading || refreshing}
              onClick={() => void loadReports(true)}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh data
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Report data unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index} className="border-border/70">
              <CardHeader className="space-y-3">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-8 w-40 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-56 animate-pulse rounded-2xl bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : report ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {summaryCards.map((card, index) => (
              <Card
                key={card.label}
                className={`border-border/70 bg-gradient-to-br ${summaryCardTone[index % summaryCardTone.length]} shadow-sm`}
              >
                <CardHeader className="gap-2">
                  <CardDescription>{card.label}</CardDescription>
                  <CardTitle className="text-3xl tracking-tight">{card.value}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {card.detail}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ReportAreaCard
              title="Inquiry volume"
              description="Inbound inquiry activity across the selected period."
              data={inquiryData}
              series={[
                {
                  key: "inquiries",
                  label: "Inquiries",
                  color: "oklch(0.7 0.17 57)",
                },
              ]}
            />

            <ReportAreaCard
              title="Event volume"
              description="Scheduled events by event date within the selected period."
              data={eventData}
              series={[
                {
                  key: "events",
                  label: "Events",
                  color: "oklch(0.64 0.16 200)",
                },
              ]}
            />

            <ReportAreaCard
              title="Client growth"
              description="New client profiles created during the selected period."
              data={clientData}
              series={[
                {
                  key: "clients",
                  label: "New clients",
                  color: "oklch(0.71 0.17 151)",
                },
              ]}
            />

            <ReportAreaCard
              title="Pipeline comparison"
              description="Compare inquiries, scheduled events, and client growth on one timeline."
              data={comparisonData}
              series={[
                {
                  key: "inquiries",
                  label: "Inquiries",
                  color: "oklch(0.7 0.17 57)",
                },
                {
                  key: "events",
                  label: "Events",
                  color: "oklch(0.64 0.16 200)",
                },
                {
                  key: "clients",
                  label: "New clients",
                  color: "oklch(0.71 0.17 151)",
                },
              ]}
            />

            <ReportAreaCard
              title="Service mix"
              description="Compare truck events with drop-off, pickup, and other service formats."
              data={operationsMixData}
              series={[
                {
                  key: "truckEvents",
                  label: "Truck",
                  color: "oklch(0.69 0.17 57)",
                  stackId: "operations",
                },
                {
                  key: "offsiteEvents",
                  label: "Drop-off / pickup",
                  color: "oklch(0.63 0.14 221)",
                  stackId: "operations",
                },
                {
                  key: "otherOperations",
                  label: "Other",
                  color: "oklch(0.57 0.08 250)",
                  stackId: "operations",
                },
              ]}
            />

            <ReportAreaCard
              title="Package mix"
              description="Track how package demand shifts across the selected period."
              data={packagesMixData}
              series={[
                {
                  key: "basicPackages",
                  label: "Basic",
                  color: "oklch(0.74 0.13 96)",
                  stackId: "packages",
                },
                {
                  key: "premiumPackages",
                  label: "Premium",
                  color: "oklch(0.66 0.18 27)",
                  stackId: "packages",
                },
                {
                  key: "otherPackages",
                  label: "Other",
                  color: "oklch(0.58 0.09 260)",
                  stackId: "packages",
                },
              ]}
            />
          </div>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="gap-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Report notes</CardTitle>
              </div>
              <CardDescription>
                Current range: {formatRangeLabel(report.range)} with{" "}
                <span className="font-medium text-foreground">{report.granularity}</span>{" "}
                aggregation.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Revenue uses the event <code>cost</code> field when available. If cost is
                  blank, the report falls back to package-based pricing estimates using the
                  current guest count.
                </p>
                <p>
                  Event filtering uses <code>eventDate</code>, while inquiry and client charts
                  use created timestamps. This keeps demand and scheduled workload aligned to
                  how the team works day to day.
                </p>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  CSV export includes the summary metrics and every aggregated bucket shown in
                  the charts above.
                </p>
                <p>
                  PDF export is generated in-app without adding a new dependency, so the file
                  is a clean data-first report rather than an embedded chart capture.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}
