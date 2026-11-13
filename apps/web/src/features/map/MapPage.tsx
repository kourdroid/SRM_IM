import { PanelRight } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router"

import { useTheme } from "@/components/shared/theme-context"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useDashboardFilters } from "@/data/filters"
import { useCommunes, useIncidents, type Incident } from "@/data/incidents"
import { buildPosteIndex, toNetworkLines, toPostePoints, useNetwork, type NetworkDepart } from "@/data/network"
import { IncidentMap, type IncidentMapHandle } from "@/features/map/components/IncidentMap"
import { DayStrip } from "@/features/map/components/DayStrip"
import { IncidentDetailPanel } from "@/features/map/components/IncidentDetailPanel"
import { MapFilterPanel, MapModeToggle, MapNetworkPanel } from "@/features/map/components/MapControls"
import {
  buildDayBuckets,
  dayKeysForPeriod,
  hasPosition,
  type MapMode,
} from "@/features/map/geo"
import { useMediaQuery } from "@/features/map/useMediaQuery"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const NO_INCIDENTS: Incident[] = []
const NO_DEPARTS: NetworkDepart[] = []
const RECENT_LIMIT = 20
const NETWORK_STORAGE_KEY = "intervx.map.network"

/** Remembers whether the network layer was left on; storage can be blocked, so failures fall back to off. */
function readNetworkPreference(): boolean {
  try {
    return window.localStorage.getItem(NETWORK_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function saveNetworkPreference(visible: boolean) {
  try {
    window.localStorage.setItem(NETWORK_STORAGE_KEY, visible ? "1" : "0")
  } catch {
    // Storage unavailable: the choice simply lasts for this visit.
  }
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatNumber(count)} ${count > 1 ? pluralForm : singular}`
}

/**
 * Carte des incidents: the map fills the content area, filters and the day replay float over it,
 * and the detail panel sits beside it on wide screens or opens as a Sheet below 1280px.
 */
export function MapPage() {
  const { state, setFilter, queryFilters } = useDashboardFilters()
  const incidentsQuery = useIncidents(queryFilters)
  const communesQuery = useCommunes()
  const { resolvedTheme } = useTheme()
  const isWide = useMediaQuery("(min-width: 1280px)")
  const isPhone = useMediaQuery("(max-width: 639px)")

  const [mode, setMode] = useState<MapMode>("points")
  // "Voir sur la carte" from the incidents list passes ?incident=<id>: start with it selected.
  const [searchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("incident"))
  const flewToLinkedIncident = useRef(false)
  const [dayKey, setDayKey] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const mapRef = useRef<IncidentMapHandle>(null)

  const [networkVisible, setNetworkVisible] = useState(readNetworkPreference)
  const [highlightedDepartId, setHighlightedDepartId] = useState<string | null>(null)
  const networkQuery = useNetwork(networkVisible)
  const networkData = networkQuery.data
  const posteIndex = useMemo(() => buildPosteIndex(networkData), [networkData])
  const posteNames = useMemo(() => [...posteIndex.keys()], [posteIndex])
  const networkLines = useMemo(
    () => (networkData ? toNetworkLines(networkData.departs, posteIndex) : null),
    [networkData, posteIndex],
  )
  const networkPostes = useMemo(
    () => (networkData ? toPostePoints(networkData.postes, posteIndex) : null),
    [networkData, posteIndex],
  )
  const networkDeparts = networkData?.departs ?? NO_DEPARTS
  const networkError = networkQuery.isError
    ? networkQuery.error instanceof Error
      ? networkQuery.error.message
      : "Chargement impossible."
    : null

  const handleNetworkVisibleChange = useCallback((visible: boolean) => {
    setNetworkVisible(visible)
    saveNetworkPreference(visible)
    if (!visible) setHighlightedDepartId(null)
  }, [])

  const incidents = incidentsQuery.data ?? NO_INCIDENTS
  const positioned = useMemo(() => incidents.filter(hasPosition), [incidents])

  const dayKeys = useMemo(() => dayKeysForPeriod(state.period, new Date()), [state.period])
  const buckets = useMemo(() => buildDayBuckets(positioned, dayKeys), [positioned, dayKeys])
  // A day chosen under another period is ignored instead of being reset in an effect.
  const activeDay = buckets.some((bucket) => bucket.key === dayKey) ? dayKey : null

  const selected = useMemo(() => positioned.find((item) => item.id === selectedId) ?? null, [positioned, selectedId])
  const recent = useMemo(() => positioned.slice(0, RECENT_LIMIT), [positioned])

  // Once the linked incident is loaded, centre the map on it (only once, never on later selections).
  useEffect(() => {
    if (flewToLinkedIncident.current || !selected || selected.id !== searchParams.get("incident")) return
    flewToLinkedIncident.current = true
    mapRef.current?.flyToIncident(selected.id)
  }, [selected, searchParams])

  const handleMapSelect = useCallback(
    (id: string) => {
      setSelectedId(id)
      if (!isWide) setSheetOpen(true)
    },
    [isWide],
  )

  const handleListSelect = useCallback(
    (id: string) => {
      setSelectedId(id)
      mapRef.current?.flyToIncident(id)
      if (!isWide) setSheetOpen(false)
    },
    [isWide],
  )

  const handleClear = useCallback(() => {
    setSelectedId(null)
    if (!isWide) setSheetOpen(false)
  }, [isWide])

  const detail = (
    <IncidentDetailPanel
      incident={selected}
      recent={recent}
      onSelect={handleListSelect}
      onClear={handleClear}
      className="h-full"
    />
  )

  const loadError = incidentsQuery.isError
    ? incidentsQuery.error instanceof Error
      ? incidentsQuery.error.message
      : "Chargement des incidents impossible."
    : null

  return (
    <div className="flex h-[max(560px,calc(100svh_-_8.5rem))] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Carte des incidents</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {`${plural(positioned.length, "position", "positions")} sur ${plural(incidents.length, "incident", "incidents")}`}
          </p>
        </div>
        {!isWide ? (
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            <PanelRight aria-hidden="true" />
            Détail et liste
          </Button>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Carte des incidents" className="relative min-h-[420px] overflow-hidden rounded-xl bg-card shadow-soft">
          <IncidentMap
            ref={mapRef}
            incidents={positioned}
            dayKey={activeDay}
            selectedId={selectedId}
            onSelect={handleMapSelect}
            mode={mode}
            theme={resolvedTheme}
            networkLines={networkLines}
            networkPostes={networkPostes}
            networkVisible={networkVisible}
            highlightedDepartId={highlightedDepartId}
          />

          <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%_-_4.5rem)] flex-col items-start gap-2">
            <MapModeToggle mode={mode} onModeChange={setMode} />
            <MapFilterPanel
              state={state}
              setFilter={setFilter}
              communes={communesQuery.data ?? []}
              communesLoading={communesQuery.isPending}
            />
            <MapNetworkPanel
              visible={networkVisible}
              onVisibleChange={handleNetworkVisibleChange}
              departs={networkDeparts}
              departsLoading={networkVisible && networkQuery.isPending}
              departsError={networkError}
              posteNames={posteNames}
              highlightedDepartId={highlightedDepartId}
              onHighlightChange={setHighlightedDepartId}
              defaultExpanded={!isPhone}
            />
          </div>

          <div className="absolute inset-x-3 bottom-9 z-10 sm:right-auto sm:w-[28rem]">
            <DayStrip buckets={buckets} activeKey={activeDay} onSelectDay={setDayKey} />
          </div>

          {incidentsQuery.isPending || loadError || (!incidentsQuery.isPending && positioned.length === 0) ? (
            <p
              role={loadError ? "alert" : "status"}
              className={cn(
                "absolute top-3 left-1/2 z-10 max-w-[70%] -translate-x-1/2 rounded-full bg-card/90 px-3 py-1.5 text-center text-sm shadow-soft-lg backdrop-blur",
                loadError ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {loadError ?? (incidentsQuery.isPending ? "Chargement des incidents…" : "Aucune position pour ces filtres")}
            </p>
          ) : null}
        </section>

        {isWide ? (
          <aside aria-label="Détail de l'incident" className="min-h-0 overflow-hidden rounded-xl bg-card shadow-soft">
            {detail}
          </aside>
        ) : null}
      </div>

      <Sheet open={sheetOpen && !isWide} onOpenChange={setSheetOpen}>
        <SheetContent
          side={isPhone ? "bottom" : "right"}
          className={cn("gap-0 border-0 bg-card p-0 shadow-soft-lg", isPhone && "max-h-[85svh] rounded-t-2xl")}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Détail et liste des incidents</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{detail}</div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
