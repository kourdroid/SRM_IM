import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type RowSelectionState,
  type SortDirection,
  type SortingState,
} from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EllipsisVertical,
  Map as MapIcon,
  Navigation,
  RefreshCw,
  Search,
  TriangleExclamationPoint,
} from "lucide-react"
import { useMemo, type Dispatch, type KeyboardEvent, type MouseEvent, type SetStateAction } from "react"
import { Link } from "react-router"

import { EmptyState } from "@/components/shared/EmptyState"
import { NetworkBadge } from "@/components/shared/NetworkBadge"
import { StatusPill } from "@/components/shared/StatusPill"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { isLateEntry, type Incident } from "@/data/incidents"
import { formatDateTime, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import {
  buildMapHref,
  googleMapsRouteUrl,
  hasPosition,
  INCIDENT_SORTERS,
  PAGE_SIZE,
} from "../table-utils"

/**
 * The table is built from TanStack Table v9 (`useTable`). Sorting and row selection are controlled
 * by the page, so the action bar and the export read the same state. Pagination is internal.
 */
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowSelectionFeature,
})

type IncidentsFeatures = typeof features

const helper = createColumnHelper<IncidentsFeatures, Incident>()

/** Elements that handle their own clicks; a click on them must not open the detail panel. */
const INTERACTIVE_SELECTOR = "button, a, input, label, [role='checkbox'], [role='menuitem']"

const SKELETON_ROWS = 8

function buildColumns({ mapSearch, onOpenIncident }: { mapSearch: string; onOpenIncident: (id: string) => void }) {
  return helper.columns([
    helper.display({
      id: "select",
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Sélectionner tous les incidents de cette page"
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
          onClick={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Sélectionner l'incident ${row.original.incidentType} du ${formatDateTime(row.original.date)}`}
          checked={row.getIsSelected()}
          onClick={row.getToggleSelectedHandler()}
        />
      ),
    }),
    helper.accessor("date", {
      id: "date",
      sortDescFirst: true,
      sortFn: (a, b) => INCIDENT_SORTERS.date(a.original, b.original),
      header: ({ header }) => (
        <SortButton label="Date" sorted={header.column.getIsSorted()} onToggle={header.column.getToggleSortingHandler()} />
      ),
      cell: ({ row }) => <DateCell incident={row.original} />,
    }),
    helper.display({
      id: "network",
      enableSorting: false,
      header: "Réseau",
      cell: ({ row }) => <NetworkBadge network={row.original.network} />,
    }),
    helper.accessor("incidentType", {
      id: "type",
      sortFn: (a, b) => INCIDENT_SORTERS.type(a.original, b.original),
      header: ({ header }) => (
        <SortButton label="Type" sorted={header.column.getIsSorted()} onToggle={header.column.getToggleSortingHandler()} />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.incidentType}</span>,
    }),
    helper.accessor("commune", {
      id: "commune",
      sortFn: (a, b) => INCIDENT_SORTERS.commune(a.original, b.original),
      header: ({ header }) => (
        <SortButton label="Lieu" sorted={header.column.getIsSorted()} onToggle={header.column.getToggleSortingHandler()} />
      ),
      cell: ({ row }) => <LocationCell incident={row.original} />,
    }),
    helper.accessor("agentName", {
      id: "agent",
      sortFn: (a, b) => INCIDENT_SORTERS.agent(a.original, b.original),
      header: ({ header }) => (
        <SortButton label="Agent" sorted={header.column.getIsSorted()} onToggle={header.column.getToggleSortingHandler()} />
      ),
      cell: ({ row }) =>
        row.original.agentName ? row.original.agentName : <span className="text-muted-foreground">—</span>,
    }),
    helper.accessor("status", {
      id: "status",
      sortFn: (a, b) => INCIDENT_SORTERS.status(a.original, b.original),
      header: ({ header }) => (
        <SortButton label="Statut" sorted={header.column.getIsSorted()} onToggle={header.column.getToggleSortingHandler()} />
      ),
      cell: ({ row }) => <StatusPill status={row.original.status} />,
    }),
    helper.display({
      id: "position",
      enableSorting: false,
      header: "Position",
      cell: ({ row }) => <PositionCell incident={row.original} />,
    }),
    helper.display({
      id: "actions",
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <IncidentActionsMenu incident={row.original} mapSearch={mapSearch} onOpenIncident={onOpenIncident} />
      ),
    }),
  ])
}

type IncidentsTableProps = {
  rows: Incident[]
  status: "loading" | "error" | "ready"
  hasActiveFilters: boolean
  /** Current URL query, used to keep the filters when jumping to the map. */
  mapSearch: string
  sorting: SortingState
  onSortingChange: Dispatch<SetStateAction<SortingState>>
  rowSelection: RowSelectionState
  onRowSelectionChange: Dispatch<SetStateAction<RowSelectionState>>
  onOpenIncident: (id: string) => void
  onRetry: () => void
  onResetFilters: () => void
}

/**
 * Incidents table in a soft, horizontally scrollable card with a sticky header, plus loading,
 * error and empty states and client-side pagination.
 */
export function IncidentsTable({
  rows,
  status,
  hasActiveFilters,
  mapSearch,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  onOpenIncident,
  onRetry,
  onResetFilters,
}: IncidentsTableProps) {
  const columns = useMemo(() => buildColumns({ mapSearch, onOpenIncident }), [mapSearch, onOpenIncident])

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZE } },
    state: { sorting, rowSelection },
    onSortingChange,
    onRowSelectionChange,
  })

  if (status === "loading") {
    return (
      <div role="status" aria-label="Chargement des incidents" className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-soft">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (status === "error") {
    return (
      <EmptyState
        icon={TriangleExclamationPoint}
        title="Impossible de charger les incidents"
        description="Vérifiez votre connexion, puis réessayez."
        action={
          <Button variant="secondary" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Réessayer
          </Button>
        }
      />
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Aucun incident ne correspond à ces filtres"
        action={
          hasActiveFilters ? (
            <Button variant="secondary" onClick={onResetFilters}>
              Réinitialiser
            </Button>
          ) : undefined
        }
      />
    )
  }

  const { pageIndex, pageSize } = table.state.pagination
  const total = table.getRowCount()
  const first = total === 0 ? 0 : pageIndex * pageSize + 1
  const last = Math.min(total, (pageIndex + 1) * pageSize)

  function openFromRowClick(event: MouseEvent<HTMLTableRowElement>, id: string) {
    const target = event.target
    // Ignore clicks coming from portalled menus: React bubbles them through the row.
    if (!(target instanceof Element) || !event.currentTarget.contains(target)) return
    if (target.closest(INTERACTIVE_SELECTOR)) return
    onOpenIncident(id)
  }

  function openFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (event.target !== event.currentTarget || event.key !== "Enter") return
    event.preventDefault()
    onOpenIncident(id)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-[70svh] overflow-auto rounded-xl bg-card shadow-soft">
        <table className="w-full min-w-[1000px] text-sm">
          <caption className="sr-only">
            Liste des incidents, {formatNumber(total)} résultat{total > 1 ? "s" : ""}
          </caption>
          <TableHeader className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    aria-sort={header.column.getCanSort() ? ariaSortValue(header.column.getIsSorted()) : undefined}
                    className={cn(
                      "text-sm",
                      header.id === "select" && "w-10",
                      header.id === "actions" && "w-px text-right",
                    )}
                  >
                    {header.isPlaceholder ? null : <FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const incident = row.original
              const selected = row.getIsSelected()
              return (
                <TableRow
                  key={row.id}
                  aria-selected={selected}
                  tabIndex={0}
                  onClick={(event) => openFromRowClick(event, incident.id)}
                  onKeyDown={(event) => openFromKeyboard(event, incident.id)}
                  className={cn(
                    "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60",
                    selected && "bg-lime/15 hover:bg-lime/20",
                  )}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        cell.column.id === "select" && "w-10",
                        cell.column.id === "actions" && "w-px text-right",
                      )}
                    >
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {first}–{last} sur {formatNumber(total)}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="relative after:absolute after:-inset-1 after:content-['']">
            <ChevronLeft aria-hidden="true" />
            Précédent
          </Button>
          <Button variant="ghost" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="relative after:absolute after:-inset-1 after:content-['']">
            Suivant
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ariaSortValue(sorted: false | SortDirection): "ascending" | "descending" | "none" {
  if (sorted === "asc") return "ascending"
  if (sorted === "desc") return "descending"
  return "none"
}

/** Header label that toggles sorting; the state is also exposed on the <th> through aria-sort. */
function SortButton({
  label,
  sorted,
  onToggle,
}: {
  label: string
  sorted: false | SortDirection
  onToggle: ((event: unknown) => void) | undefined
}) {
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown

  return (
    <button
      type="button"
      onClick={onToggle}
      className="-mx-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
    >
      {label}
      <Icon
        aria-hidden="true"
        className={cn("size-3.5 shrink-0", sorted ? "text-foreground" : "text-muted-foreground/60")}
      />
    </button>
  )
}

function DateCell({ incident }: { incident: Incident }) {
  const late = isLateEntry(incident)

  return (
    <div className="flex flex-col gap-0.5">
      <span className="tabular-nums">{formatDateTime(incident.date)}</span>
      {late ? (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-medium text-warning"
          title={`Saisi le ${formatDateTime(incident.createdAt)}`}
        >
          <TriangleExclamationPoint className="size-3" aria-hidden="true" />
          Saisi après coup
        </span>
      ) : null}
    </div>
  )
}

function LocationCell({ incident }: { incident: Incident }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold">{incident.commune}</span>
      {incident.village ? <span className="text-xs text-muted-foreground">{incident.village}</span> : null}
    </div>
  )
}

function PositionCell({ incident }: { incident: Incident }) {
  if (!hasPosition(incident)) {
    return <span className="text-muted-foreground" aria-label="Position non relevée">—</span>
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
      <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
      Relevée
    </span>
  )
}

function IncidentActionsMenu({
  incident,
  mapSearch,
  onOpenIncident,
}: {
  incident: Incident
  mapSearch: string
  onOpenIncident: (id: string) => void
}) {
  const { latitude, longitude } = incident

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions pour l'incident du ${formatDateTime(incident.date)}`} className="relative after:absolute after:-inset-1 after:content-['']">
          <EllipsisVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 rounded-xl shadow-soft-lg">
        <DropdownMenuItem onSelect={() => onOpenIncident(incident.id)}>
          <Eye aria-hidden="true" />
          Voir le détail
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={buildMapHref(mapSearch, incident.id)}>
            <MapIcon aria-hidden="true" />
            Voir sur la carte
          </Link>
        </DropdownMenuItem>
        {latitude !== null && longitude !== null ? (
          <DropdownMenuItem asChild>
            <a href={googleMapsRouteUrl(latitude, longitude)} target="_blank" rel="noreferrer">
              <Navigation aria-hidden="true" />
              Itinéraire Google Maps
            </a>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
