import { ChevronDown, ChevronUp, Network as NetworkIcon } from "lucide-react"
import { useId, useMemo, useState } from "react"

import { SegmentedControl } from "@/components/shared/SegmentedControl"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import { PERIOD_OPTIONS, type DashboardFilterState, type PeriodKey } from "@/data/filters"
import type { Commune, Network } from "@/data/incidents"
import { groupDepartsByPoste, type NetworkDepart } from "@/data/network"
import type { MapMode } from "@/features/map/geo"
import { networkPosteColor } from "@/features/map/network-style"

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

const ALL_DEPARTS = "all"

/** Dash pattern sample for the legend: solid for aerial, dashed for underground. */
function LineSample({ dashed }: { dashed: boolean }) {
  return (
    <svg width="20" height="4" viewBox="0 0 20 4" aria-hidden="true" className="shrink-0">
      <line
        x1="0"
        y1="2"
        x2="20"
        y2="2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
    </svg>
  )
}

/**
 * Floating HTA network controls: a switch for the layer, a départ highlighter and a legend of the postes colors.
 * On phones it can be collapsed to the switch row.
 */
export function MapNetworkPanel({
  visible,
  onVisibleChange,
  departs,
  departsLoading,
  departsError,
  posteNames,
  highlightedDepartId,
  onHighlightChange,
  defaultExpanded = true,
}: {
  visible: boolean
  onVisibleChange: (visible: boolean) => void
  departs: NetworkDepart[]
  departsLoading: boolean
  departsError: string | null
  /** Poste names in color-index order; the index picks the color of each poste. */
  posteNames: string[]
  highlightedDepartId: string | null
  onHighlightChange: (departId: string | null) => void
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const bodyId = useId()
  const groups = useMemo(() => groupDepartsByPoste(departs), [departs])

  return (
    <div
      role="group"
      aria-label="Réseau HTA"
      className="flex w-full max-w-72 flex-col gap-2 rounded-xl bg-card/90 p-2.5 shadow-soft-lg backdrop-blur"
    >
      <div className="flex items-center gap-1">
        <Toggle
          pressed={visible}
          onPressedChange={onVisibleChange}
          aria-controls={visible && expanded ? bodyId : undefined}
          className="min-w-0 flex-1 justify-start"
        >
          <NetworkIcon aria-hidden="true" />
          Réseau HTA
        </Toggle>
        {visible ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-expanded={expanded}
            aria-controls={bodyId}
            aria-label={expanded ? "Masquer les détails du réseau" : "Afficher les détails du réseau"}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </Button>
        ) : null}
      </div>

      {visible && expanded ? (
        <div id={bodyId} className="flex flex-col gap-2">
          <Select
            value={highlightedDepartId ?? ALL_DEPARTS}
            onValueChange={(value) => onHighlightChange(value === ALL_DEPARTS ? null : value)}
            disabled={departsLoading || departs.length === 0}
          >
            <SelectTrigger size="sm" aria-label="Mettre en évidence un départ" className="w-full">
              <SelectValue placeholder={departsLoading ? "Chargement…" : "Tous les départs"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DEPARTS}>Tous les départs</SelectItem>
              {groups.map((group) => (
                <SelectGroup key={group.poste}>
                  <SelectLabel>{group.poste}</SelectLabel>
                  {group.departs.map((depart) => (
                    <SelectItem key={depart.id} value={depart.id}>
                      {depart.depart}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          {departsError ? <p className="text-xs text-muted-foreground">Réseau indisponible : {departsError}</p> : null}

          {posteNames.length > 0 ? (
            <div className="flex flex-col gap-2">
              <ul aria-label="Légende des postes sources" className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
                {posteNames.map((name, index) => (
                  <li key={name} className="flex items-center gap-2 text-xs">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: networkPosteColor(index) }}
                    />
                    <span className="truncate">{name}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <LineSample dashed={false} />
                  Aérien
                </span>
                <span className="flex items-center gap-1.5">
                  <LineSample dashed />
                  Souterrain
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
