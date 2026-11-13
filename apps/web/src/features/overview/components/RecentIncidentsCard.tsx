import { ArrowRight } from "lucide-react"
import { Link } from "react-router"

import { NetworkBadge } from "@/components/shared/NetworkBadge"
import { SectionCard } from "@/components/shared/SectionCard"
import { StatusPill } from "@/components/shared/StatusPill"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { isLateEntry, type Incident } from "@/data/incidents"
import { formatDayMonthTime } from "@/features/overview/stats"

/** Compact table of the latest incidents. The table scrolls horizontally inside the card on small screens. */
export function RecentIncidentsCard({
  incidents,
  search,
  className,
}: {
  incidents: Incident[]
  search: string
  className?: string
}) {
  return (
    <SectionCard
      title="Derniers incidents"
      className={className}
      contentClassName="px-0"
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/incidents${search}`}>
            Tout voir
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      <Table>
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead className="px-(--card-spacing)">Date</TableHead>
            <TableHead>Réseau</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Lieu</TableHead>
            <TableHead className="pr-(--card-spacing)">Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((incident) => (
            <TableRow key={incident.id} className="border-b-0">
              <TableCell className="px-(--card-spacing)">
                <div className="flex flex-col gap-0.5">
                  <span className="tabular-nums">{formatDayMonthTime(incident.date)}</span>
                  {isLateEntry(incident) ? <span className="text-xs text-warning">saisi après coup</span> : null}
                </div>
              </TableCell>
              <TableCell>
                <NetworkBadge network={incident.network} />
              </TableCell>
              <TableCell>{incident.incidentType}</TableCell>
              <TableCell>
                {[incident.commune, incident.village].filter(Boolean).join(" · ")}
              </TableCell>
              <TableCell className="pr-(--card-spacing)">
                <StatusPill status={incident.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  )
}
