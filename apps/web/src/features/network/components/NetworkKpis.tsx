import { KpiCard } from "@/components/shared/KpiCard"
import { formatNumber } from "@/lib/format"

import { formatKm, pluralize, type NetworkSummary } from "../network-stats"

/** Four headline tiles: postes, départs, network length and the share linked to the application. */
export function NetworkKpis({ summary }: { summary: NetworkSummary }) {
  const totalKm = summary.aerialKm + summary.undergroundKm
  const unlinked = summary.departs - summary.linked

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Postes sources" value={formatNumber(summary.postes)} />
      <KpiCard
        label="Départs"
        value={formatNumber(summary.departs)}
        footnote={pluralize(summary.departs, "départ HTA", "départs HTA")}
      />
      <KpiCard
        label="Km de réseau"
        value={`${formatKm(totalKm)} km`}
        footnote={`${formatKm(summary.aerialKm)} km aérien · ${formatKm(summary.undergroundKm)} km souterrain`}
      />
      <KpiCard
        label="Départs reliés"
        value={formatNumber(summary.linked)}
        footnote={
          unlinked > 0 ? `${formatNumber(unlinked)} non relié${unlinked > 1 ? "s" : ""} à l'application` : "Tous reliés à l'application"
        }
      />
    </div>
  )
}
