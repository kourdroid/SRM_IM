import { RotateCcw, Search } from "lucide-react"

import { FilterBar } from "@/components/shared/FilterBar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import {
  APPROVAL_LABELS,
  APPROVAL_OPTIONS,
  ROLE_LABELS,
  ROLE_OPTIONS,
  hasActiveUserFilters,
  toApprovalStatus,
  toUserRole,
  type UserFilters,
} from "../user-utils"

/** Search by name or e-mail, role and status filters. The reset button shows only when a filter is set. */
export function UsersFilterBar({
  filters,
  onChange,
  onReset,
}: {
  filters: UserFilters
  onChange: (next: UserFilters) => void
  onReset: () => void
}) {
  return (
    <FilterBar className="gap-2 p-2.5">
      <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Nom ou adresse e-mail…"
          aria-label="Rechercher un utilisateur"
          className="h-9 border-0 bg-card pl-9 shadow-soft"
        />
      </div>

      <Select
        value={filters.role}
        onValueChange={(value) => onChange({ ...filters, role: value === "all" ? "all" : toUserRole(value) ?? "all" })}
      >
        <SelectTrigger aria-label="Filtrer par rôle" className="h-9 min-w-40 border-0 bg-card shadow-soft">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl shadow-soft-lg">
          <SelectItem value="all">Tous les rôles</SelectItem>
          {ROLE_OPTIONS.map((role) => (
            <SelectItem key={role} value={role}>
              {ROLE_LABELS[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(value) => onChange({ ...filters, status: value === "all" ? "all" : toApprovalStatus(value) ?? "all" })}
      >
        <SelectTrigger aria-label="Filtrer par statut" className="h-9 min-w-40 border-0 bg-card shadow-soft">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl shadow-soft-lg">
          <SelectItem value="all">Tous les statuts</SelectItem>
          {APPROVAL_OPTIONS.map((status) => (
            <SelectItem key={status} value={status}>
              {APPROVAL_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveUserFilters(filters) ? (
        <Button variant="ghost" size="sm" className="h-9" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          Réinitialiser
        </Button>
      ) : null}
    </FilterBar>
  )
}
