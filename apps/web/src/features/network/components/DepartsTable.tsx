import { ArrowDown, ArrowUp, ArrowUpDown, Map as MapIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { networkPosteColor } from "@/features/map/network-style"
import { formatDateTime, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { formatKm, pluralize, type DepartRow, type PosteGroup, type SortKey, type SortState } from "../network-stats"

const COLUMN_COUNT = 6

type SortableHeadProps = {
  label: string
  sortKey: SortKey
  sort: SortState
  onSort: (key: SortKey) => void
  align?: "left" | "right"
  className?: string
}

/** Column header button that toggles the sort and exposes aria-sort to assistive technology. */
function SortableHead({ label, sortKey, sort, onSort, align = "left", className }: SortableHeadProps) {
  const active = sort.key === sortKey
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
  const Icon = active ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <TableHead aria-sort={ariaSort} className={cn(align === "right" && "text-right", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </TableHead>
  )
}

function PosteGroupRow({ group }: { group: PosteGroup }) {
  return (
    <TableRow className="bg-muted/40 hover:bg-muted/40">
      <TableCell colSpan={COLUMN_COUNT} className="py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tracking-wide text-muted-foreground uppercase">
          <span className="flex items-center gap-2 font-medium">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: networkPosteColor(group.colorIndex) }}
              aria-hidden="true"
            />
            {group.poste}
          </span>
          <span className="tabular-nums">
            {group.rows.length === 0
              ? "Aucun départ enregistré"
              : `${pluralize(group.rows.length, "départ", "départs")} · ${formatKm(group.aerialKm)} km aérien · ${formatKm(group.undergroundKm)} km souterrain · ${formatNumber(group.incidentCount)} incident${group.incidentCount > 1 ? "s" : ""} MT`}
          </span>
        </div>
      </TableCell>
    </TableRow>
  )
}

function DepartRowView({ row, onViewOnMap }: { row: DepartRow; onViewOnMap: () => void }) {
  return (
    <TableRow className="group/row">
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{row.depart}</span>
          {row.linked ? null : <span className="text-xs text-muted-foreground">Non relié à l&apos;application</span>}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatKm(row.aerialKm)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatKm(row.undergroundKm)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {row.incidentCount === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatNumber(row.incidentCount)
        )}
      </TableCell>
      <TableCell className="tabular-nums">
        {row.lastIncident ? formatDateTime(row.lastIncident) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="w-px text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewOnMap}
          aria-label={`Voir le départ ${row.depart} sur la carte`}
          className="h-7 px-2 text-muted-foreground transition-colors group-focus-within/row:text-foreground group-hover/row:text-foreground"
        >
          <MapIcon aria-hidden="true" className="size-3.5" />
          Voir sur la carte
        </Button>
      </TableCell>
    </TableRow>
  )
}

/**
 * Départs grouped by poste source. Sorting applies inside each group, so the poste grouping stays intact.
 * The table scrolls horizontally inside its card on narrow screens.
 */
export function DepartsTable({
  groups,
  sort,
  onSort,
  onViewOnMap,
}: {
  groups: PosteGroup[]
  sort: SortState
  onSort: (key: SortKey) => void
  onViewOnMap: () => void
}) {
  return (
    <Table aria-label="Départs par poste source">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <SortableHead label="Départ" sortKey="depart" sort={sort} onSort={onSort} />
          <SortableHead label="Aérien (km)" sortKey="aerial" sort={sort} onSort={onSort} align="right" />
          <SortableHead label="Souterrain (km)" sortKey="underground" sort={sort} onSort={onSort} align="right" />
          <SortableHead label="Incidents MT" sortKey="incidents" sort={sort} onSort={onSort} align="right" />
          <SortableHead label="Dernier incident" sortKey="last" sort={sort} onSort={onSort} />
          <TableHead className="w-px">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <TableRowGroup key={group.poste} group={group} onViewOnMap={onViewOnMap} />
        ))}
      </TableBody>
    </Table>
  )
}

function TableRowGroup({ group, onViewOnMap }: { group: PosteGroup; onViewOnMap: () => void }) {
  return (
    <>
      <PosteGroupRow group={group} />
      {group.rows.length === 0 ? (
        <TableRow>
          <TableCell colSpan={COLUMN_COUNT} className="text-muted-foreground">
            Aucun départ à afficher pour ce poste.
          </TableCell>
        </TableRow>
      ) : (
        group.rows.map((row) => <DepartRowView key={row.id} row={row} onViewOnMap={onViewOnMap} />)
      )}
    </>
  )
}
