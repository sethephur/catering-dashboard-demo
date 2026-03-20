import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { Inquiry } from "@/shared-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type InquiryVolumeChartProps = {
  inquiries: Inquiry[];
  defaultRange?: RangeKey;
};

type RangeKey = "week" | "month" | "year";

type ChartPoint = {
  bucketKey: string;
  label: string;
  fullLabel: string;
  inquiries: number;
};

const chartConfig = {
  inquiries: {
    label: "Inquiries",
    color: "oklch(0.68 0.19 45)",
  },
} satisfies ChartConfig;

const rangeCopy: Record<RangeKey, { title: string; subtitle: string }> = {
  week: {
    title: "Last 7 days",
    subtitle: "Daily inquiry volume for the past week",
  },
  month: {
    title: "Last 30 days",
    subtitle: "Daily inquiry volume for the past month",
  },
  year: {
    title: "Last 12 months",
    subtitle: "Monthly inquiry volume over the past year",
  },
};

const startOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
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

const toDayKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;

const toMonthKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;

const toMillis = (value: unknown): number => {
  try {
    if (!value) return 0;
    if (
      typeof value === "object" &&
      value != null &&
      "toDate" in value &&
      typeof (value as { toDate?: () => Date }).toDate === "function"
    ) {
      return (value as { toDate: () => Date }).toDate().getTime();
    }
    if (typeof value === "object" && value != null && "seconds" in value) {
      const seconds = (value as { seconds?: unknown }).seconds;
      if (typeof seconds === "number") return seconds * 1000;
    }
    if (typeof value === "string") {
      const direct = Date.parse(value);
      if (!Number.isNaN(direct)) return direct;
      const normalized = value
        .replace(/\sat\s/i, " ")
        .replace(/\u202F/g, " ")
        .replace(/UTC/g, "GMT");
      const fallback = Date.parse(normalized);
      if (!Number.isNaN(fallback)) return fallback;
    }
  } catch {
    return 0;
  }
  return 0;
};

const buildChartData = (inquiries: Inquiry[], range: RangeKey): ChartPoint[] => {
  const now = new Date();
  const weekAxisFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  });
  const dayAxisFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  const monthAxisFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
  });
  const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const fullMonthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });

  if (range === "year") {
    const start = addMonths(startOfMonth(now), -11);
    const buckets = Array.from({ length: 12 }, (_, index) => {
      const month = addMonths(start, index);
      return {
        bucketKey: toMonthKey(month),
        label: monthAxisFormatter.format(month),
        fullLabel: fullMonthFormatter.format(month),
        inquiries: 0,
      };
    });

    const bucketIndexByMonthKey = new Map(
      buckets.map((bucket, index) => [bucket.bucketKey, index]),
    );

    inquiries.forEach((inquiry) => {
      const ms = toMillis(inquiry.createdAt ?? inquiry.created_at ?? inquiry.dateCreated);
      if (!ms) return;
      const created = new Date(ms);
      const bucketIndex = bucketIndexByMonthKey.get(toMonthKey(created));
      if (typeof bucketIndex === "number") {
        buckets[bucketIndex].inquiries += 1;
      }
    });

    return buckets;
  }

  const bucketCount = range === "week" ? 7 : 30;
  const start = addDays(startOfDay(now), -(bucketCount - 1));
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const day = addDays(start, index);
    return {
      bucketKey: toDayKey(day),
      label:
        bucketCount === 7
          ? weekAxisFormatter.format(day)
          : dayAxisFormatter.format(day),
      fullLabel: fullDateFormatter.format(day),
      inquiries: 0,
    };
  });

  const bucketIndexByDayKey = new Map(
    buckets.map((bucket, index) => [bucket.bucketKey, index]),
  );

  inquiries.forEach((inquiry) => {
    const ms = toMillis(inquiry.createdAt ?? inquiry.created_at ?? inquiry.dateCreated);
    if (!ms) return;
    const created = startOfDay(new Date(ms));
    const bucketIndex = bucketIndexByDayKey.get(toDayKey(created));
    if (typeof bucketIndex === "number") {
      buckets[bucketIndex].inquiries += 1;
    }
  });

  return buckets;
};

export default function InquiryVolumeChart({
  inquiries,
  defaultRange = "month",
}: InquiryVolumeChartProps) {
  const [range, setRange] = useState<RangeKey>(defaultRange);

  useEffect(() => {
    setRange(defaultRange);
  }, [defaultRange]);

  const chartData = useMemo(
    () => buildChartData(inquiries, range),
    [inquiries, range],
  );

  const totalInquiries = useMemo(
    () => chartData.reduce((sum, point) => sum + point.inquiries, 0),
    [chartData],
  );

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-col gap-4 border-b border-border/60 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="text-xl">Inquiry Volume</CardTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {rangeCopy[range].title}. {rangeCopy[range].subtitle}. Total
            inquiries in range: {totalInquiries}.
          </p>
        </div>

        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(value) => {
            if (value === "week" || value === "month" || value === "year") {
              setRange(value);
            }
          }}
          className="w-fit rounded-xl border border-border bg-background p-1"
        >
          <ToggleGroupItem value="week" className="rounded-lg px-4">
            Week
          </ToggleGroupItem>
          <ToggleGroupItem value="month" className="rounded-lg px-4">
            Month
          </ToggleGroupItem>
          <ToggleGroupItem value="year" className="rounded-lg px-4">
            Year
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>

      <CardContent className="pt-6">
        <ChartContainer config={chartConfig} className="h-[240px] w-full">
          <AreaChart
            data={chartData}
            margin={{ left: 12, right: 12, top: 18, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fillInquiries" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-inquiries)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-inquiries)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    String(payload?.[0]?.payload?.fullLabel ?? "")
                  }
                />
              }
            />
            <Area
              type="monotone"
              dataKey="inquiries"
              stroke="var(--color-inquiries)"
              strokeWidth={2}
              fill="url(#fillInquiries)"
              fillOpacity={1}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
