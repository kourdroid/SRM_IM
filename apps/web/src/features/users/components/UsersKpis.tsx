import { KpiCard } from "@/components/shared/KpiCard"
import { formatNumber } from "@/lib/format"

import type { UserCounts } from "../user-utils"

/** Headline counts for the user list: accounts, pending requests and the number of each role. */
export function UsersKpis({ counts }: { counts: UserCounts }) {
  const approvedLabel = counts.approved === 1 ? "approuvé" : "approuvés"

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <KpiCard
        label="Comptes"
        value={formatNumber(counts.total)}
        footnote={`${formatNumber(counts.approved)} ${approvedLabel}`}
      />
      <KpiCard
        label="En attente"
        value={formatNumber(counts.pending)}
        footnote={counts.pending === 0 ? "Aucune demande" : "À valider"}
      />
      <KpiCard label="Agents terrain" value={formatNumber(counts.field)} footnote="Saisie des incidents" />
      <KpiCard label="Administrateurs" value={formatNumber(counts.admin)} footnote="Accès complet" />
      <KpiCard label="Directeurs" value={formatNumber(counts.director)} footnote="Consultation seule" />
    </div>
  )
}
