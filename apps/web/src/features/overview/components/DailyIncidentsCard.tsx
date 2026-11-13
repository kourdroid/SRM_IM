import { TriangleAlert } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Rectangle, XAxis, YAxis } from "recharts"

import { SectionCard } from "@/components/shared/SectionCard"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatNumber } from "@/lib/format"
import {
  dayLongLabel,
  dayShortLabel,
  formatDayKey,
  type DailyBucket,
} from "@/features/overview/stats"

const chartConfig = {
  bt: { label: "BT", color: "var(--bt)" },
  mt: { label: "MT", color: "var(--mt)" },
} satisfies ChartConfig

const TOP_RADIUS: [number, number, number, number] = [4, 4, 0, 0]

type ChartRow = { day: string; fullDay: string; bt: number; mt: number; total: number }

type SegmentProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  payload?: ChartRow
}

/** BT sits at the bottom of the stack; it only gets rounded corners when no MT is stacked above it. */
function BtSegment({ x = 0, y = 0, width = 0, height = 0, fill, payload }: SegmentProps) {
  const isTop = payload?.mt === 0
  return <Rectangle x={x} y={y} width={width} height={height} fill={fill} radius={isTop ? TOP_RADIUS : 0} />
}

/** MT is always the top of the stack, so its top corners are rounded. */
function MtSegment({ x = 0, y = 0, width = 0, height = 0, fill }: SegmentProps) {
  return <Rectangle x={x} y={y} width={width} height={height} fill={fill} radius={TOP_RADIUS} />
}

/** Stacked BT/MT bars per calendar day, with the peaks (days at 2x the average) called out below. */
export function DailyIncidentsCard({
  buckets,
  peaks,
  className,
}: {
  buckets: DailyBucket[]
  peaks: DailyBucket[]
  className?: string
}) {
  const data: ChartRow[] = buckets.map((bucket) => ({
    day: dayShortLabel(bucket.day),
    fullDay: dayLongLabel(bucket.day),
    bt: bucket.bt,
    mt: bucket.mt,
    total: bucket.total,
  }))
  const total = buckets.reduce((sum, bucket) => sum + bucket.total, 0)
  const bt = buckets.reduce((sum, bucket) => sum + bucket.bt, 0)
  const mt = total - bt
  const summary = [
    `Incidents par jour sur ${buckets.length} jours : ${formatNumber(total)} au total, dont ${formatNumber(bt)} BT et ${formatNumber(mt)} MT.`,
    ...peaks.map((peak) => `Pic de ${formatNumber(peak.total)} le ${formatDayKey(peak.day)}.`),
  ].join(" ")

  return (
    <SectionCard
      title="Incidents par jour"
      description={`${buckets.length} derniers jours, par réseau`}
      className={className}
      contentClassName="gap-4"
    >
      <div role="img" aria-label={summary}>
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullDay ?? ""}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="bt" stackId="incidents" fill="var(--color-bt)" shape={BtSegment} />
            <Bar dataKey="mt" stackId="incidents" fill="var(--color-mt)" shape={MtSegment} />
          </BarChart>
        </ChartContainer>
      </div>

      {peaks.length > 0 ? (
        <div className="flex gap-3 rounded-lg bg-warning-soft p-3 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <ul className="flex flex-col gap-0.5">
            {peaks.map((peak) => (
              <li key={peak.day} className="tabular-nums">
                Pic{"\u00A0"}: {formatNumber(peak.total)} incident{peak.total > 1 ? "s" : ""} le {formatDayKey(peak.day)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  )
}
