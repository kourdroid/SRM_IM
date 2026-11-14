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
import type { ReportDailyPoint } from "@/data/reports"
import { shiftDay } from "@/features/reports/report-form"
import { APP_LOCALE, formatNumber } from "@/lib/format"

const chartConfig = {
  bt: { label: "BT", color: "var(--bt)" },
  mt: { label: "MT", color: "var(--mt)" },
} satisfies ChartConfig

const TOP_RADIUS: [number, number, number, number] = [4, 4, 0, 0]

const tickFormatter = new Intl.DateTimeFormat(APP_LOCALE, { day: "numeric", month: "short", timeZone: "UTC" })
const fullDayFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

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

/** Every calendar day of the range, oldest first, with zero counts where no incident was recorded. */
function buildRows(startDate: string, dayCount: number, points: ReportDailyPoint[]): ChartRow[] {
  const byDay = new Map(points.map((point) => [point.day, point]))
  return Array.from({ length: dayCount }, (_, index) => {
    const day = shiftDay(startDate, index)
    const date = new Date(`${day}T00:00:00Z`)
    const point = byDay.get(day)
    const bt = point?.bt ?? 0
    const mt = point?.mt ?? 0
    return { day, fullDay: fullDayFormatter.format(date), bt, mt, total: bt + mt }
  })
}

/** Stacked BT/MT incidents per calendar day, the same look as the overview daily chart. */
export function DailyTrendCard({
  startDate,
  dayCount,
  points,
  className,
}: {
  startDate: string
  dayCount: number
  points: ReportDailyPoint[]
  className?: string
}) {
  const data = buildRows(startDate, dayCount, points)
  const total = data.reduce((sum, row) => sum + row.total, 0)
  const bt = data.reduce((sum, row) => sum + row.bt, 0)
  const mt = total - bt
  const summary = `Incidents par jour sur ${formatNumber(dayCount)} jours : ${formatNumber(total)} au total, dont ${formatNumber(bt)} BT et ${formatNumber(mt)} MT.`

  return (
    <SectionCard
      title="Évolution journalière"
      description={`${formatNumber(dayCount)} jours, par réseau`}
      className={className}
      contentClassName="gap-4"
    >
      <div role="img" aria-label={summary}>
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
              tickFormatter={(value: string) => tickFormatter.format(new Date(`${value}T00:00:00Z`))}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
            <ChartTooltip
              content={
                <ChartTooltipContent labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullDay ?? ""} />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="bt" stackId="incidents" fill="var(--color-bt)" shape={BtSegment} />
            <Bar dataKey="mt" stackId="incidents" fill="var(--color-mt)" shape={MtSegment} />
          </BarChart>
        </ChartContainer>
      </div>
    </SectionCard>
  )
}
