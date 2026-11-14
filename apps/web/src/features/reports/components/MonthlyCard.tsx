import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { EmptyState } from "@/components/shared/EmptyState"
import { SectionCard } from "@/components/shared/SectionCard"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ReportPoint } from "@/data/reports"
import { APP_LOCALE, formatNumber } from "@/lib/format"

const chartConfig = {
  total: { label: "Incidents", color: "var(--chart-1)" },
} satisfies ChartConfig

const shortMonth = new Intl.DateTimeFormat(APP_LOCALE, { month: "short", year: "2-digit", timeZone: "UTC" })
const longMonth = new Intl.DateTimeFormat(APP_LOCALE, { month: "long", year: "numeric", timeZone: "UTC" })

/** Parses a "YYYY-MM" label into a UTC date for formatting. Returns null for anything else. */
function monthDate(label: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(label)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))
}

type ChartRow = { month: string; fullMonth: string; total: number }

/** Incidents per month over the filtered period. */
export function MonthlyCard({ points, className }: { points: ReportPoint[]; className?: string }) {
  const data: ChartRow[] = points.map((point) => {
    const date = monthDate(point.label)
    return {
      month: date ? shortMonth.format(date) : point.label,
      fullMonth: date ? longMonth.format(date) : point.label,
      total: point.value,
    }
  })
  const total = points.reduce((sum, point) => sum + point.value, 0)

  return (
    <SectionCard
      title="Évolution mensuelle"
      description="Nombre d'incidents déclarés par mois"
      className={className}
      contentClassName="gap-4"
    >
      {points.length === 0 ? (
        <EmptyState title="Aucune donnée pour cette période." />
      ) : (
        <div role="img" aria-label={`Incidents par mois : ${formatNumber(total)} au total sur ${points.length} mois.`}>
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullMonth ?? ""}
                  />
                }
              />
              <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </SectionCard>
  )
}
