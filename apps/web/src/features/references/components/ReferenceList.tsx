import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
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
import { cn } from "@/lib/utils"
import type { Direction, ListStatus } from "@/features/references/reference-utils"

const REORDER_LOCKED_REASON = "Effacez la recherche pour changer l'ordre."
const SKELETON_ROWS = 6

export type ReferenceEntry = { id: string; name: string }

export type ReferenceColumn<T> = {
  id: string
  header: string
  cell: (item: T) => ReactNode
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
  /** Extra toolbar controls, e.g. a network filter. */
  filters?: ReactNode
  addLabel?: string
  onAdd?: () => void
  /** When given, a status column shows Actif or Inactif. */
  isActive?: (item: T) => boolean
  onToggleActive?: (item: T) => void
  /** Up and down buttons. Moves are locked while the list is searched, since the saved order must be complete. */
  onMove?: (item: T, direction: Direction) => void
  reorderLocked?: boolean
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  /** Explains why a row cannot be deleted. Returns null when deletion is allowed. */
  deleteBlockedReason?: (item: T) => string | null
  busy?: boolean
  emptyIcon?: LucideIcon
  emptyTitle: string
  emptyDescription: string
}

/**
 * Reusable CRUD list for the reference catalogues: search, optional filters, add button, and per row a
 * status badge, reorder, activate, edit and delete actions. Actions appear only when their handler is given.
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
  const hasActions = Boolean(onMove || onToggleActive || onEdit || onDelete)
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
        title="Aucun résultat"
        description={`Aucun élément ne correspond à « ${trimmedQuery} ».`}
        action={
          <Button variant="ghost" onClick={() => onQueryChange("")}>
            Effacer la recherche
          </Button>
        }
      />
    )
  } else if (total === 0) {
    body = (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={
          onAdd && addLabel ? (
            <Button onClick={onAdd}>
              <Plus aria-hidden="true" />
              {addLabel}
            </Button>
          ) : undefined
        }
      />
    )
  } else {
    body = (
      <div className="overflow-hidden rounded-xl bg-card shadow-soft">
        <Table>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader className="[&_tr]:border-foreground/[0.04]">
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead key={column.id} className={cn("h-11 text-muted-foreground", column.className)}>
                  {column.header}
                </TableHead>
              ))}
              {hasStatus ? <TableHead className="h-11 text-muted-foreground">Statut</TableHead> : null}
              {hasActions ? (
                <TableHead className="h-11 w-px">
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
                    <TableCell colSpan={columnCount} className="bg-muted/50 text-xs font-medium text-muted-foreground">
                      {group.label}
                    </TableCell>
                  </TableRow>
                ) : null}
                {group.items.map((item, index) => {
                  const active = isActive ? isActive(item) : true
                  const deleteReason = deleteBlockedReason ? deleteBlockedReason(item) : null
                  const isFirst = index === 0
                  const isLast = index === group.items.length - 1

                  return (
                    <TableRow key={item.id} className="border-foreground/[0.04]">
                      {columns.map((column) => (
                        <TableCell key={column.id} className={column.className}>
                          {column.cell(item)}
                        </TableCell>
                      ))}
                      {hasStatus ? (
                        <TableCell>
                          <StatusBadge active={active} />
                        </TableCell>
                      ) : null}
                      {hasActions ? (
                        <TableCell>
                          <div className="flex items-center justify-end gap-0.5">
                            {onMove ? (
                              <>
                                <IconAction
                                  label={`Monter ${item.name}`}
                                  icon={ChevronUp}
                                  disabled={busy || reorderLocked || isFirst}
                                  reason={reorderLocked ? REORDER_LOCKED_REASON : undefined}
                                  onClick={() => onMove(item, "up")}
                                />
                                <IconAction
                                  label={`Descendre ${item.name}`}
                                  icon={ChevronDown}
                                  disabled={busy || reorderLocked || isLast}
                                  reason={reorderLocked ? REORDER_LOCKED_REASON : undefined}
                                  onClick={() => onMove(item, "down")}
                                />
                              </>
                            ) : null}
                            {onToggleActive ? (
                              <IconAction
                                label={active ? `Désactiver ${item.name}` : `Activer ${item.name}`}
                                icon={active ? EyeOff : Eye}
                                disabled={busy}
                                onClick={() => onToggleActive(item)}
                              />
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
                              <IconAction
                                label={`Supprimer ${item.name}`}
                                icon={Trash2}
                                destructive
                                disabled={busy || deleteReason !== null}
                                reason={deleteReason ?? undefined}
                                onClick={() => onDelete(item)}
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
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
        {onAdd && addLabel && total > 0 ? (
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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
        active ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
      )}
    >
      {active ? "Actif" : "Inactif"}
    </span>
  )
}

/** Icon-only row action. The tooltip shows the label, or the reason when the action is blocked. */
function IconAction({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  reason,
  destructive = false,
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled?: boolean
  reason?: string
  destructive?: boolean
}) {
  const explain = disabled && reason ? reason : undefined

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={explain ? `${label}. ${explain}` : label}
            disabled={disabled}
            onClick={onClick}
            className={cn(destructive && "text-destructive hover:text-destructive")}
          >
            <Icon aria-hidden="true" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{explain ?? label}</TooltipContent>
    </Tooltip>
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
