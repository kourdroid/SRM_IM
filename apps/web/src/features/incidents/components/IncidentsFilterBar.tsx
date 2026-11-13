import { Search, RotateCcw } from "lucide-react"

import { FilterBar } from "@/components/shared/FilterBar"
import { SegmentedControl, type SegmentedOption } from "@/components/shared/SegmentedControl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PERIOD_OPTIONS, type PeriodKey, type useDashboardFilters } from "@/data/filters"
import type { Commune, IncidentStatus, Network } from "@/data/incidents"

type FilterControls = Pick<ReturnType<typeof useDashboardFilters>, "state" | "setFilter">

const NETWORK_OPTIONS: SegmentedOption<Network | "all">[] = [
  { value: "all", label: "Tous", ariaLabel: "Tous les réseaux" },
  { value: "BT", label: "BT", ariaLabel: "Basse tension (BT)" },
  { value: "MT", label: "MT", ariaLabel: "Moyenne tension (MT)" },
]

const STATUS_OPTIONS: { value: IncidentStatus | "all"; label: string }[] = [
  { value: "all", label: "Tous les statuts" },
  { value: "open", label: "En cours" },
  { value: "closed", label: "Clôturé" },
]

function toPeriodKey(value: string): PeriodKey {
  return PERIOD_OPTIONS.find((option) => option.value === value)?.value ?? "30d"
}

function toStatusFilter(value: string): IncidentStatus | "all" {
  return value === "open" || value === "closed" ? value : "all"
}

/**
 * Filter row: free-text search (the caller debounces it), network, period, commune and status.
 * URL-backed filters go through `setFilter`; the reset button appears when anything is active.
 */
export function IncidentsFilterBar({
  filters,
  communes,
  search,
  onSearchChange,
  isActive,
  onReset,
}: {
  filters: FilterControls
  communes: Commune[]
  search: string
  onSearchChange: (value: string) => void
  isActive: boolean
  onReset: () => void
}) {
  const { state, setFilter } = filters

  return (
    <FilterBar className="gap-2 p-2.5">
      <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Village, commune, type, agent…"
          aria-label="Rechercher un incident"
          className="h-9 border-0 bg-card pl-9 shadow-soft"
        />
      </div>

      <SegmentedControl<Network | "all">
        value={state.network}
        onValueChange={(value) => setFilter("network", value)}
        options={NETWORK_OPTIONS}
        ariaLabel="Réseau"
        className="bg-card shadow-soft"
      />

      <Select value={state.period} onValueChange={(value) => setFilter("period", toPeriodKey(value))}>
        <SelectTrigger aria-label="Période" className="h-9 min-w-36 border-0 bg-card shadow-soft">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl shadow-soft-lg">
          {PERIOD_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={state.communeId} onValueChange={(value) => setFilter("communeId", value)}>
        <SelectTrigger aria-label="Commune" className="h-9 min-w-40 max-w-56 border-0 bg-card shadow-soft">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl shadow-soft-lg">
          <SelectItem value="all">Toutes les communes</SelectItem>
          {communes.map((commune) => (
            <SelectItem key={commune.id} value={commune.id}>
              {commune.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={state.status} onValueChange={(value) => setFilter("status", toStatusFilter(value))}>
        <SelectTrigger aria-label="Statut" className="h-9 min-w-36 border-0 bg-card shadow-soft">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl shadow-soft-lg">
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isActive ? (
        <Button variant="ghost" size="sm" className="h-9" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          Réinitialiser
        </Button>
      ) : null}
    </FilterBar>
  )
}
