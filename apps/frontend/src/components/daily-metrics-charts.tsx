import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@repo/ui/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/ui/toggle-group";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { MetricInfo } from "@/components/metric-info";
import type { DailyMetricsResponse, MetricsRangePreset } from "@/lib/metrics-api";

type DailyMetricPoint = DailyMetricsResponse["series"][number];

const RANGE_PRESETS: { value: MetricsRangePreset; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "180d", label: "6m" },
  { value: "365d", label: "1y" },
  { value: "all", label: "All" },
];

/** Absolute TSB/form bands (Intervals.icu-style defaults). */
const FORM_ZONES = [
  {
    key: "risk",
    label: "High risk",
    y1: -1000,
    y2: -30,
    fill: "oklch(0.63 0.2 25 / 0.16)",
    description: "TSB below -30: overreaching risk — monitor recovery closely.",
  },
  {
    key: "optimal",
    label: "Optimal",
    y1: -30,
    y2: -10,
    fill: "oklch(0.72 0.14 145 / 0.18)",
    description: "TSB -30 to -10: productive training load (fitness-building).",
  },
  {
    key: "neutral",
    label: "Neutral",
    y1: -10,
    y2: 10,
    fill: "oklch(0.78 0.01 0 / 0.22)",
    description: "TSB -10 to +10: maintenance / stagnant — little fitness change.",
  },
  {
    key: "fresh",
    label: "Fresh",
    y1: 10,
    y2: 1000,
    fill: "oklch(0.72 0.12 230 / 0.16)",
    description: "TSB above +10: fresher form — useful for racing or hard efforts.",
  },
] as const;

const fitnessChartConfig = {
  ctl: {
    label: "CTL",
    color: "var(--chart-1)",
  },
  atl: {
    label: "ATL",
    color: "var(--chart-2)",
  },
  tsb: {
    label: "TSB",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const loadChartConfig = {
  trainingLoad: {
    label: "Training load",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const activitiesChartConfig = {
  activityCount: {
    label: "Activities",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FitnessChart({ series }: { series: DailyMetricPoint[] }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-1">
          Fitness & fatigue
          <MetricInfo label="About fitness and fatigue">
            CTL is chronic training load (42-day fitness). ATL is acute training load (7-day
            fatigue). TSB is training stress balance (form: previous CTL minus ATL). Background
            bands are form zones for TSB (Intervals.icu absolute defaults).
          </MetricInfo>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1">
            CTL
            <MetricInfo label="About CTL">
              Chronic Training Load: 42-day exponentially weighted average of daily load (fitness).
            </MetricInfo>
          </span>
          <span className="inline-flex items-center gap-1">
            ATL
            <MetricInfo label="About ATL">
              Acute Training Load: 7-day exponentially weighted average of daily load (fatigue).
            </MetricInfo>
          </span>
          <span className="inline-flex items-center gap-1">
            TSB
            <MetricInfo label="About TSB">
              Training Stress Balance: previous day&apos;s CTL minus ATL (form / freshness). Zone
              colors apply to this series.
            </MetricInfo>
          </span>
        </CardDescription>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {FORM_ZONES.map((zone) => (
            <span key={zone.key} className="inline-flex items-center gap-1.5 text-xs">
              <span
                className="ring-border/40 size-2.5 shrink-0 rounded-[2px] ring-1"
                style={{ backgroundColor: zone.fill }}
              />
              {zone.label}
              <MetricInfo label={`About ${zone.label} zone`}>{zone.description}</MetricInfo>
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={fitnessChartConfig} className="min-h-[240px] w-full">
          <LineChart accessibilityLayer data={series} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatShortDate}
            />
            <YAxis tickLine={false} axisLine={false} width={40} />
            {FORM_ZONES.map((zone) => (
              <ReferenceArea
                key={zone.key}
                y1={zone.y1}
                y2={zone.y2}
                fill={zone.fill}
                strokeOpacity={0}
                ifOverflow="hidden"
              />
            ))}
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={formatFullDate} indicator="line" />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="ctl"
              type="monotone"
              stroke="var(--color-ctl)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="atl"
              type="monotone"
              stroke="var(--color-atl)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="tsb"
              type="monotone"
              stroke="var(--color-tsb)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function DailyLoadChart({ series }: { series: DailyMetricPoint[] }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-1">
          Daily training load
          <MetricInfo label="About training load">
            Daily TSS-equivalent stress summed from activities that day.
          </MetricInfo>
        </CardTitle>
        <CardDescription>TSS-equivalent load per day</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={loadChartConfig} className="min-h-[240px] w-full">
          <BarChart accessibilityLayer data={series} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatShortDate}
            />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={formatFullDate} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="trainingLoad" fill="var(--color-trainingLoad)" radius={2} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function ActivitiesPerDayChart({ series }: { series: DailyMetricPoint[] }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-1">
          Activities per day
          <MetricInfo label="About activities per day">
            Number of activities with a computed training load on that day.
          </MetricInfo>
        </CardTitle>
        <CardDescription>Count of loaded activities per day</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={activitiesChartConfig} className="min-h-[240px] w-full">
          <BarChart accessibilityLayer data={series} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatShortDate}
            />
            <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={formatFullDate} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="activityCount" fill="var(--color-activityCount)" radius={2} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function DailyMetricsCharts({
  series,
  isLoading,
  rangePreset,
  onRangePresetChange,
}: {
  series: DailyMetricPoint[] | undefined;
  isLoading: boolean;
  rangePreset: MetricsRangePreset;
  onRangePresetChange: (preset: MetricsRangePreset) => void;
}) {
  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">Date range</p>
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[rangePreset]}
          onValueChange={(values) => {
            const next = values[0];
            if (next) {
              onRangePresetChange(next as MetricsRangePreset);
            }
          }}
        >
          {RANGE_PRESETS.map((preset) => (
            <ToggleGroupItem key={preset.value} value={preset.value}>
              {preset.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading metrics…</p>
      ) : !series?.length ? (
        <p className="text-muted-foreground text-sm">No metrics yet</p>
      ) : (
        <>
          <FitnessChart series={series} />
          <DailyLoadChart series={series} />
          <ActivitiesPerDayChart series={series} />
        </>
      )}
    </div>
  );
}
