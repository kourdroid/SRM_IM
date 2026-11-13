import type { RowSelectionState, SortingState } from "@tanstack/react-table"
import { Download, Map as MapIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { useDashboardFilters } from "@/data/filters"
import { useCommunes, useIncidents, type Commune, type Incident } from "@/data/incidents"
import { cn } from "@/lib/utils"

import { IncidentDetailSheet } from "./components/IncidentDetailSheet"
import { IncidentsFilterBar } from "./components/IncidentsFilterBar"
import { IncidentsTable } from "./components/IncidentsTable"
import { IncidentsViewTabs } from "./components/IncidentsViewTabs"
import { SelectionActionBar } from "./components/SelectionActionBar"
import {
  buildIncidentsCsv,
  buildMapHref,
  countIncidentViews,
  DEFAULT_SORTING,
  filterIncidentsBySearch,
  incidentsExportFileName,
  matchesIncidentView,
  parseIncidentView,
  sortIncidents,
  type IncidentViewKey,
} from "./table-utils"
import { useDebouncedValue } from "./useDebouncedValue"

const NO_INCIDENTS: Incident[] = []
const NO_COMMUNES: Commune[] = []
const SEARCH_DEBOUNCE_MS = 200

/** Incident list: saved views, filters, sortable table, selection, CSV export and detail panel. */
export function IncidentsPage() {
  const filters = useDashboardFilters()
  const { reset, queryFilters, isFiltered } = filters
  const [params, setParams] = useSearchParams()
  const incidents = useIncidents(queryFilters)
  const communes = useCommunes()

  const [searchInput, setSearchInput] = useState("")
  const search = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS)
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const view = parseIncidentView(params.get("vue"))
  const incidentId = params.get("incident")

  const allRows = incidents.data ?? NO_INCIDENTS
  const searchedRows = useMemo(() => filterIncidentsBySearch(allRows, search), [allRows, search])
  const viewCounts = useMemo(() => countIncidentViews(searchedRows), [searchedRows])
  const rows = useMemo(() => searchedRows.filter((row) => matchesIncidentView(row, view)), [searchedRows, view])
  const selectedRows = useMemo(() => rows.filter((row) => rowSelection[row.id]), [rows, rowSelection])
  const selectedIncident = incidentId ? allRows.find((row) => row.id === incidentId) : undefined

  const isSearching = searchInput.trim() !== ""
  const isActive = isFiltered || isSearching || view !== "tous"
  const mapHref = buildMapHref(params.toString())

  const status = incidents.data === undefined && incidents.isError ? "error" : incidents.isPending ? "loading" : "ready"

  const setView = useCallback(
    (next: IncidentViewKey) => {
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          if (next === "tous") updated.delete("vue")
          else updated.set("vue", next)
          return updated
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setIncidentParam = useCallback(
    (id: string | null) => {
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          if (id) updated.set("incident", id)
          else updated.delete("incident")
          return updated
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const openIncident = useCallback((id: string) => setIncidentParam(id), [setIncidentParam])

  function resetFilters() {
    reset()
    setSearchInput("")
  }

  function exportCsv() {
    const source = selectedRows.length > 0 ? selectedRows : rows
    const csv = buildIncidentsCsv(sortIncidents(source, sorting))
    downloadTextFile(incidentsExportFileName(new Date()), csv)
  }

  return (
    <div className={cn("flex flex-col gap-6", selectedRows.length > 0 && "pb-24")}>
      <PageHeader
        title="Incidents"
        description="Triés par date de l'incident. Les saisies tardives sont signalées."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link to={mapHref}>
                <MapIcon aria-hidden="true" />
                Voir sur la carte
              </Link>
            </Button>
            <Button onClick={exportCsv} disabled={rows.length === 0}>
              <Download aria-hidden="true" />
              Exporter Excel
            </Button>
          </>
        }
      />

      <IncidentsViewTabs value={view} counts={viewCounts} onValueChange={setView} />

      <IncidentsFilterBar
        filters={filters}
        communes={communes.data ?? NO_COMMUNES}
        search={searchInput}
        onSearchChange={setSearchInput}
        isActive={isActive}
        onReset={resetFilters}
      />

      <IncidentsTable
        rows={rows}
        status={status}
        hasActiveFilters={isActive}
        mapSearch={params.toString()}
        sorting={sorting}
        onSortingChange={setSorting}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        onOpenIncident={openIncident}
        onRetry={() => void incidents.refetch()}
        onResetFilters={resetFilters}
      />

      <IncidentDetailSheet
        open={Boolean(incidentId)}
        incident={selectedIncident}
        isLoading={incidents.isPending}
        onOpenChange={(open) => {
          if (!open) setIncidentParam(null)
        }}
      />

      {selectedRows.length > 0 ? (
        <SelectionActionBar
          count={selectedRows.length}
          mapHref={mapHref}
          onExport={exportCsv}
          onClear={() => setRowSelection({})}
        />
      ) : null}
    </div>
  )
}

/** Saves text as a file through a temporary object URL. */
function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
