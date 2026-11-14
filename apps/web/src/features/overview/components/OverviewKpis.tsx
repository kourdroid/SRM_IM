import { CircleCheck } from "lucide-react"
import type { ReactNode } from "react"

import { KpiCard } from "@/components/shared/KpiCard"
import { formatNumber, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"
import { formatHours, type DailyBucket, type OverviewSummary } from "@/features/overview/stats"

/**
 * Four headline cards. Footnotes sit in the chart slot of KpiCard because its footnote prop only accepts plain text
 * (BT/MT colours, icons and the progress bar need richer content).
 */
export function OverviewKpis({
  summary,
  periodLabel,
  sparkline,
}: {
  summary: OverviewSummary
  periodLabel: string
  /** Most recent daily buckets, drawn as the sparkline of the first card. */
  sparkline: DailyBucket[]
}) {
  const agentsLabel = summary.agents === 1 ? "1 agent actif" : `${formatNumber(summary.agents)} agents actifs`

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label={`Incidents · ${periodLabel}`}
        revealDelay={0}
        value={formatNumber(summary.total)}
        chart={
          <KpiDetail>
            <p className="text-xs tabular-nums text-muted-foreground">
              <span className="font-medium text-bt">BT {formatNumber(summary.bt)}</span>
              {" · "}
              <span className="font-medium text-mt">MT {formatNumber(summary.mt)}</span>
              {" · "}
              {agentsLabel}
            </p>
            <Sparkline buckets={sparkline} />
          </KpiDetail>
        }
      />

      <KpiCard
        label="En cours"
        revealDelay={40}
        value={formatNumber(summary.open)}
        chart={
          <KpiDetail>
            {summary.open === 0 ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                <CircleCheck className="size-3.5 shrink-0" aria-hidden="true" />
                Tous les incidents sont clôturés
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">à traiter</p>
            )}
          </KpiDetail>
        }
      />

      <KpiCard
        label="Durée moyenne"
        revealDelay={80}
        value={formatHours(summary.averageClosureHours)}
        chart={
          <KpiDetail>
            <p className="text-xs text-muted-foreground">De la déclaration à la clôture</p>
          </KpiDetail>
        }
      />

      <KpiCard
        label="Réclamations"
        variant="inverted"
        revealDelay={120}
        value={formatNumber(summary.reclamations)}
        chart={
          <KpiDetail inverted>
            <p className="text-xs tabular-nums">{formatPercent(summary.reclamationRatio)} du total</p>
            <div
              role="progressbar"
              aria-label="Part des réclamations dans les incidents"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(summary.reclamationRatio * 100)}
              className="h-1.5 overflow-hidden rounded-full bg-white/15 dark:bg-muted"
            >
              <div
                className="h-full rounded-full bg-lime transition-[width] dark:bg-primary"
                style={{ width: `${Math.min(summary.reclamationRatio * 100, 100)}%` }}
              />
            </div>
          </KpiDetail>
        }
      />
    </div>
  )
}

/** Footnote block placed under the value: pulled up so the gap matches a native KpiCard footnote. */
function KpiDetail({ children, inverted = false }: { children: ReactNode; inverted?: boolean }) {
  return (
    <div className={cn("-mt-2 flex flex-col gap-3", inverted ? "text-white/70 dark:text-muted-foreground" : undefined)}>
      {children}
    </div>
  )
}

/** Compact bar trend, one bar per day; the last bar (today) is highlighted. Zero days keep a small visible stub. */
function Sparkline({ buckets }: { buckets: DailyBucket[] }) {
  const peak = Math.max(1, ...buckets.map((bucket) => bucket.total))
  const total = buckets.reduce((sum, bucket) => sum + bucket.total, 0)

  return (
    <div
      role="img"
      aria-label={`Tendance sur ${buckets.length} jours : ${formatNumber(total)} incidents`}
      className="flex h-10 items-end gap-1"
    >
      {buckets.map((bucket, index) => (
        <span
          key={bucket.day}
          aria-hidden="true"
          className={cn("min-w-0 flex-1 rounded-sm", index === buckets.length - 1 ? "bg-primary" : "bg-muted-foreground/30")}
          style={{ height: `${Math.max((bucket.total / peak) * 100, 8)}%` }}
        />
      ))}
    </div>
  )
}
