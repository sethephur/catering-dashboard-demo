import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type ReportAreaDatum = {
  label: string;
  fullLabel: string;
  [key: string]: string | number;
};

export type ReportAreaSeries = {
  key: string;
  label: string;
  color: string;
  stackId?: string;
  formatter?: (value: number) => string;
};

type ReportAreaCardProps = {
  title: string;
  description: string;
  data: ReportAreaDatum[];
  series: ReportAreaSeries[];
  valueFormatter?: (value: number) => string;
};

const formatValue = (value: number) =>
  new Intl.NumberFormat("en-US").format(Math.round(value));

export function ReportAreaCard({
  title,
  description,
  data,
  series,
  valueFormatter,
}: ReportAreaCardProps) {
  const chartId = useId().replace(/:/g, "");

  const chartConfig = series.reduce<ChartConfig>((config, item) => {
    config[item.key] = {
      label: item.label,
      color: item.color,
    };
    return config;
  }, {});

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="gap-4 border-b border-border/60">
        <div className="space-y-1">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {series.map((item) => (
            <Badge
              key={item.key}
              variant="secondary"
              className="gap-2 rounded-full px-3 py-1"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart data={data} margin={{ left: 12, right: 12, top: 18, bottom: 0 }}>
            <defs>
              {series.map((item) => (
                <linearGradient
                  key={item.key}
                  id={`${chartId}-${item.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={`var(--color-${item.key})`}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={`var(--color-${item.key})`}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
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
              width={40}
              tickFormatter={(value) =>
                valueFormatter
                  ? valueFormatter(Number(value))
                  : formatValue(Number(value))
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    String(payload?.[0]?.payload?.fullLabel ?? "")
                  }
                  formatter={(value, name) => {
                    const numeric =
                      typeof value === "number"
                        ? value
                        : Number.parseFloat(String(value ?? 0));
                    const matchedSeries = series.find(
                      (item) => item.key === String(name),
                    );

                    if (matchedSeries?.formatter) {
                      return matchedSeries.formatter(numeric);
                    }

                    if (valueFormatter) {
                      return valueFormatter(numeric);
                    }

                    return formatValue(numeric);
                  }}
                />
              }
            />
            {series.map((item) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                stackId={item.stackId}
                stroke={`var(--color-${item.key})`}
                strokeWidth={2}
                fill={`url(#${chartId}-${item.key})`}
                fillOpacity={1}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
