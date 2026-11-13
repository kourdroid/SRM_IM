import { SegmentedControl } from "@/components/shared/SegmentedControl"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PERIOD_OPTIONS, type DashboardFilterState, type PeriodKey } from "@/data/filters"
import type { Commune, Network } from "@/data/incidents"
import type { MapMode } from "@/features/map/geo"

/** Setter returned by useDashboardFilters: writes one filter into the URL. */
export type SetFilter = <K extends keyof DashboardFilterState>(key: K, value: DashboardFilterState[K]) => void

const MODE_OPTIONS: { value: MapMode; label: string; ariaLabel: string }[] = [
  { value: "points", label: "Points", ariaLabel: "Afficher les points" },
  { value: "heat", label: "Densité", ariaLabel: "Afficher la densité" },
]

/** Floating switch between clustered points and the density heatmap. */
export function MapModeToggle({ mode, onModeChange }: { mode: MapMode; onModeChange: (mode: MapMode) => void }) {
  return (
    <div className="w-fit rounded-xl bg-card/90 p-1 shadow-soft-lg backdrop-blur">
      <SegmentedControl<MapMode>
        value={mode}
        onValueChange={onModeChange}
        ariaLabel="Mode d'affichage de la carte"
        options={MODE_OPTIONS}
      />
    </div>
  )
}

const NETWORK_OPTIONS: { value: Network | "all"; label: string; ariaLabel: string }[] = [
  { value: "all", label: "Tous", ariaLabel: "Tous les réseaux" },
  { value: "BT", label: "BT", ariaLabel: "Basse tension" },
  { value: "MT", label: "MT", ariaLabel: "Moyenne tension" },
]

/** Floating filters (network, commune, period) bound to the URL, shared with the other pages. */
export function MapFilterPanel({
  state,
  setFilter,
  communes,
  communesLoading,
}: {
  state: DashboardFilterState
  setFilter: SetFilter
  communes: Commune[]
  communesLoading: boolean
}) {
  return (
    <div
      role="group"
      aria-label="Filtres de la carte"
      className="flex w-full max-w-72 flex-col gap-2 rounded-xl bg-card/90 p-2.5 shadow-soft-lg backdrop-blur"
    >
      <SegmentedControl<Network | "all">
        value={state.network}
        onValueChange={(value) => setFilter("network", value)}
        ariaLabel="Réseau"
        options={NETWORK_OPTIONS}
        className="w-full"
      />

      <Select
        value={state.communeId}
        onValueChange={(value) => setFilter("communeId", value)}
        disabled={communesLoading}
      >
        <SelectTrigger size="sm" aria-label="Commune" className="w-full">
          <SelectValue placeholder={communesLoading ? "Chargement…" : "Commune"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes les communes</SelectItem>
          {communes.map((commune) => (
            <SelectItem key={commune.id} value={commune.id}>
              {commune.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={state.period} onValueChange={(value) => setFilter("period", value as PeriodKey)}>
        <SelectTrigger size="sm" aria-label="Période" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
