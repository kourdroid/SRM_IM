import {
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleExclamationPoint,
  type LucideIcon,
} from "lucide-react"
import { Fragment, type ReactNode } from "react"

import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Direction, ListStatus } from "@/features/references/reference-utils"

const REORDER_LOCKED_REASON = "Effacez la recherche pour changer l'ordre."
const SKELETON_ROWS = 6
/** Icon buttons are 32px with a pointer and 44px on touch screens. */
const ICON_BUTTON_CLASS = "relative after:absolute after:-inset-1 after:content-[''] [@media(pointer:coarse)]:size-11"
/** Up and down buttons stay in the DOM for keyboard users; they show on row hover, focus, or on touch screens. */
const REORDER_REVEAL_CLASS =
  "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
const STATUS_PILL_CLASS =
  "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [@media(pointer:coarse)]:h-9"

export type ReferenceEntry = { id: string; name: string }

export type ReferenceColumn<T> = {
  id: string
  header: string
  cell: (item: T) => ReactNode
  /** Counts and short values: shrink to their content, right aligned, with tabular figures. */
  numeric?: boolean
  className?: string
}

/** Rows that share a heading, e.g. the BT and MT networks. Groups without a label get no heading row. */
export type ReferenceGroup<T> = {
  key: string
  label?: string
  items: T[]
}

export type ReferenceListProps<T extends ReferenceEntry> = {
  /** Accessible description of the table. */
  caption: string
  groups: ReferenceGroup<T>[]
  columns: ReferenceColumn<T>[]
  status: ListStatus
  errorDetail?: string
  onRetry: () => void
  query: string
  onQueryChange: (query: string) => void
  searchLabel: string
  /** Muted counts shown next to the search, e.g. "26 départs · 25 actifs". */
  summary?: string
  /** Extra toolbar controls, e.g. a network filter. */
  filters?: ReactNode
  addLabel?: string
  onAdd?: () => void
  /** When given, a status pill shows Actif or Inactif and toggles the item when clicked. */
  isActive?: (item: T) => boolean
  onToggleActive?: (item: T) => void
  /** Up and down buttons. Moves are locked while the list is searched, since the saved order must be complete. */
  onMove?: (item: T, direction: Direction) => void
  reorderLocked?: boolean
  onEdit?: (item: T) => void
  /** Delete lives in the row's "..." menu. */
  onDelete?: (item: T) => void
  /** Explains why a row cannot be deleted. Returns null when deletion is allowed. */
  deleteBlockedReason?: (item: T) => string | null
  busy?: boolean
  emptyIcon?: LucideIcon
  emptyTitle: string
  emptyDescription: string
}

/**
 * Reusable CRUD list for the reference catalogues: search, counts, optional filters, and an add button. Per
 * row: a status pill (when `isActive` is given), reorder buttons on hover, an edit button and a "..." menu for
 * delete. Actions appear only when their handler is given.
 */
export function ReferenceList<T extends ReferenceEntry>({
  caption,
  groups,
  columns,
  status,
  errorDetail,
  onRetry,
  query,
  onQueryChange,
  searchLabel,
  summary,
  filters,
  addLabel,
  onAdd,
  isActive,
  onToggleActive,
  onMove,
  reorderLocked = false,
  onEdit,
  onDelete,
  deleteBlockedReason,
  busy = false,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: ReferenceListProps<T>) {
  const visibleGroups = groups.filter((group) => group.items.length > 0)
  const total = visibleGroups.reduce((sum, group) => sum + group.items.length, 0)
  const hasStatus = isActive !== undefined
  const hasActions = Boolean(onMove || onEdit || onDelete)
  const columnCount = columns.length + (hasStatus ? 1 : 0) + (hasActions ? 1 : 0)
  const trimmedQuery = query.trim()

  let body: ReactNode
  if (status === "loading") {
    body = <ListSkeleton />
  } else if (status === "error") {
    body = (
      <EmptyState
        icon={TriangleExclamationPoint}
        title="Chargement impossible"
        description={errorDetail}
        action={
          <Button variant="secondary" onClick={onRetry}>
            Réessayer
          </Button>
        }
      />
    )
  } else if (total === 0 && trimmedQuery !== "") {
    body = (
      <EmptyState
        icon={Search}
        title={`Aucun résultat pour « ${trimmedQuery} »`}
        action={
          <Button variant="ghost" onClick={() => onQueryChange("")}>
            Effacer la recherche
          </Button>
        }
      />
    )
  } else if (total === 0) {
    body = <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
  } else {
    body = (
      <div className="overflow-hidden rounded-xl bg-card shadow-soft">
        <Table>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead key={column.id} className={columnClass(column)}>
                  {column.header}
                </TableHead>
              ))}
              {hasStatus ? <TableHead className="w-px">Statut</TableHead> : null}
              {hasActions ? (
                <TableHead className="w-px">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleGroups.map((group) => (
              <Fragment key={group.key}>
                {group.label ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={columnCount}
                      className="bg-muted/40 py-2 text-xs tracking-wide text-muted-foreground uppercase"
                    >
                      {group.label} · {formatNumber(group.items.length)}
                    </TableCell>
                  </TableRow>
                ) : null}
                {group.items.map((item, index) => {
                  const active = isActive ? isActive(item) : true
                  const deleteReason = deleteBlockedReason ? deleteBlockedReason(item) : null
                  const isFirst = index === 0
                  const isLast = index === group.items.length - 1

                  return (
                    <TableRow key={item.id} className="group [&>td]:py-1.5">
                      {columns.map((column) => (
                        <TableCell key={column.id} className={columnClass(column)}>
                          {column.cell(item)}
                        </TableCell>
                      ))}
                      {hasStatus ? (
                        <TableCell className="w-px">
                          {onToggleActive ? (
                            <StatusToggle
                              name={item.name}
                              active={active}
                              disabled={busy}
                              onToggle={() => onToggleActive(item)}
                            />
                          ) : (
                            <StatusBadge active={active} />
                          )}
                        </TableCell>
                      ) : null}
                      {hasActions ? (
                        <TableCell className="w-px">
                          <div className="flex items-center justify-end gap-2">
                            {onMove ? (
                              <>
                                <IconAction
                                  label={`Monter ${item.name}`}
                                  icon={ChevronUp}
                                  className={REORDER_REVEAL_CLASS}
                                  disabled={busy || reorderLocked || isFirst}
                                  reason={reorderLocked ? REORDER_LOCKED_REASON : undefined}
                                  onClick={() => onMove(item, "up")}
                                />
                                <IconAction
                                  label={`Descendre ${item.name}`}
                                  icon={ChevronDown}
                                  className={REORDER_REVEAL_CLASS}
                                  disabled={busy || reorderLocked || isLast}
                                  reason={reorderLocked ? REORDER_LOCKED_REASON : undefined}
                                  onClick={() => onMove(item, "down")}
                                />
                              </>
                            ) : null}
                            {onEdit ? (
                              <IconAction
                                label={`Modifier ${item.name}`}
                                icon={Pencil}
                                disabled={busy}
                                onClick={() => onEdit(item)}
                              />
                            ) : null}
                            {onDelete ? (
                              <RowMenu
                                name={item.name}
                                busy={busy}
                                blockedReason={deleteReason}
                                onDelete={() => onDelete(item)}
                              />
                            ) : null}
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 max-w-sm flex-1 basis-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
            className="h-9 border-0 bg-card pl-9 shadow-soft"
          />
        </div>
        {filters}
        {summary && status === "ready" ? (
          <p className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">{summary}</p>
        ) : null}
        {onAdd && addLabel ? (
          <Button className="ml-auto" onClick={onAdd}>
            <Plus aria-hidden="true" />
            {addLabel}
          </Button>
        ) : null}
      </div>
      {body}
    </div>
  )
}

/** Numeric columns shrink to their content; text columns take the remaining width and may wrap. */
function columnClass<T>(column: ReferenceColumn<T>): string {
  return cn(
    column.numeric ? "w-px text-right tabular-nums whitespace-nowrap" : "whitespace-normal break-words",
    column.className,
  )
}

/** Read-only status, used when the list cannot toggle items. */
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        STATUS_PILL_CLASS,
        "cursor-default",
        active ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
      )}
    >
      {active ? "Actif" : "Inactif"}
    </span>
  )
}

/** Status pill that switches the item on or off. The accessible name says what the click does. */
function StatusToggle({
  name,
  active,
  disabled,
  onToggle,
}: {
  name: string
  active: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={active ? `Désactiver ${name}` : `Activer ${name}`}
          disabled={disabled}
          onClick={onToggle}
          className={cn(
            STATUS_PILL_CLASS,
            active
              ? "bg-success-soft text-success hover:bg-success-soft/70"
              : "bg-muted text-muted-foreground hover:bg-muted-foreground/15",
          )}
        >
          {active ? "Actif" : "Inactif"}
        </button>
      </TooltipTrigger>
      <TooltipContent>{active ? "Cliquer pour désactiver" : "Cliquer pour activer"}</TooltipContent>
    </Tooltip>
  )
}

/** Icon-only row action. The tooltip shows the label, or the reason when the action is blocked. */
function IconAction({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  reason,
  className,
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled?: boolean
  reason?: string
  className?: string
}) {
  const explain = disabled && reason ? reason : undefined

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex", className)}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={explain ? `${label}. ${explain}` : label}
            disabled={disabled}
            onClick={onClick}
            className={ICON_BUTTON_CLASS}
          >
            <Icon aria-hidden="true" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{explain ?? label}</TooltipContent>
    </Tooltip>
  )
}

/** "..." menu for less frequent row actions. A blocked delete stays visible with the reason under it. */
function RowMenu({
  name,
  busy,
  blockedReason,
  onDelete,
}: {
  name: string
  busy: boolean
  blockedReason: string | null
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Autres actions pour ${name}`}
          disabled={busy}
          className={ICON_BUTTON_CLASS}
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 rounded-xl shadow-soft-lg">
        <DropdownMenuItem
          variant="destructive"
          disabled={blockedReason !== null}
          onSelect={onDelete}
          className="items-start"
        >
          <Trash2 aria-hidden="true" className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            <span>Supprimer</span>
            {blockedReason ? <span className="text-xs font-normal text-muted-foreground">{blockedReason}</span> : null}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ListSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Chargement de la liste"
      className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-soft"
    >
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full rounded-lg" />
      ))}
    </div>
  )
}
