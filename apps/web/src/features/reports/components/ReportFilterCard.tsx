import { RotateCcw } from "lucide-react"
import type { ReactNode } from "react"

import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Commune } from "@/data/incidents"
import type { ReportAgent } from "@/data/reports"
import { cn } from "@/lib/utils"
import {
  ALL,
  PRESET_OPTIONS,
  presetRange,
  type PresetKey,
  type ReportFormState,
} from "@/features/reports/report-form"

const NETWORK_LABELS: Record<ReportFormState["network"], string> = {
  [ALL]: "BT et MT",
  BT: "BT (basse tension)",
  MT: "MT (moyenne tension)",
}

const STATUS_LABELS: Record<ReportFormState["status"], string> = {
  [ALL]: "Tous les statuts",
  open: "En cours",
  closed: "Clôturé",
}

const RECLAMATION_LABELS: Record<ReportFormState["reclamation"], string> = {
  [ALL]: "Toutes",
  yes: "Avec réclamation",
  no: "Sans réclamation",
}

/** Period presets, explicit dates, and the commune, agent, network, status and claim filters. */
export function ReportFilterCard({
  form,
  today,
  communes,
  agents,
  rangeError,
  onChange,
  onReset,
  className,
}: {
  form: ReportFormState
  /** Latest selectable day (YYYY-MM-DD), used as the maximum of both date fields. */
  today: string
  communes: Commune[]
  agents: ReportAgent[]
  rangeError: string | null
  onChange: (patch: Partial<ReportFormState>) => void
  onReset: () => void
  className?: string
}) {
  function applyPreset(preset: PresetKey) {
    onChange({ preset, ...presetRange(preset, today) })
  }

  return (
    <SectionCard
      title="Période et filtres"
      description="Les indicateurs, répartitions et aperçus suivent ces filtres."
      className={className}
      contentClassName="gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterField id="report-preset" label="Période rapide">
          <Select value={form.preset ?? ""} onValueChange={(value) => applyPreset(value as PresetKey)}>
            <SelectTrigger id="report-preset" className="h-9 w-full border-0 bg-input">
              <SelectValue placeholder="Personnalisée" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-soft-lg">
              {PRESET_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField id="report-start" label="Du">
          <Input
            id="report-start"
            type="date"
            value={form.startDate}
            max={form.endDate || today}
            onChange={(event) => onChange({ startDate: event.target.value, preset: null })}
            className="bg-input"
            aria-invalid={rangeError !== null}
          />
        </FilterField>

        <FilterField id="report-end" label="Au">
          <Input
            id="report-end"
            type="date"
            value={form.endDate}
            min={form.startDate || undefined}
            max={today}
            onChange={(event) => onChange({ endDate: event.target.value, preset: null })}
            className="bg-input"
            aria-invalid={rangeError !== null}
          />
        </FilterField>

        <FilterField id="report-network" label="Réseau">
          <Select value={form.network} onValueChange={(value) => onChange({ network: value as ReportFormState["network"] })}>
            <SelectTrigger id="report-network" className="h-9 w-full border-0 bg-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-soft-lg">
              {(Object.keys(NETWORK_LABELS) as ReportFormState["network"][]).map((value) => (
                <SelectItem key={value} value={value}>
                  {NETWORK_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField id="report-commune" label="Commune">
          <Select value={form.communeId} onValueChange={(value) => onChange({ communeId: value })}>
            <SelectTrigger id="report-commune" className="h-9 w-full border-0 bg-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-soft-lg">
              <SelectItem value={ALL}>Toutes les communes</SelectItem>
              {communes.map((commune) => (
                <SelectItem key={commune.id} value={commune.id}>
                  {commune.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField id="report-agent" label="Agent">
          <Select value={form.agentId} onValueChange={(value) => onChange({ agentId: value })}>
            <SelectTrigger id="report-agent" className="h-9 w-full border-0 bg-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-soft-lg">
              <SelectItem value={ALL}>Tous les agents</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField id="report-status" label="Statut">
          <Select value={form.status} onValueChange={(value) => onChange({ status: value as ReportFormState["status"] })}>
            <SelectTrigger id="report-status" className="h-9 w-full border-0 bg-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-soft-lg">
              {(Object.keys(STATUS_LABELS) as ReportFormState["status"][]).map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField id="report-reclamation" label="Réclamation">
          <Select value={form.reclamation} onValueChange={(value) => onChange({ reclamation: value as ReportFormState["reclamation"] })}>
            <SelectTrigger id="report-reclamation" className="h-9 w-full border-0 bg-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-soft-lg">
              {(Object.keys(RECLAMATION_LABELS) as ReportFormState["reclamation"][]).map((value) => (
                <SelectItem key={value} value={value}>
                  {RECLAMATION_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          role={rangeError ? "alert" : undefined}
          className={cn("min-h-5 text-sm", rangeError ? "text-destructive" : "text-muted-foreground")}
        >
          {rangeError ?? formatSelectedRange(form)}
        </p>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          Réinitialiser les filtres
        </Button>
      </div>
    </SectionCard>
  )
}

function FilterField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

const rangeFormatter = new Intl.DateTimeFormat("fr-MA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

/** Human-readable period under the filters, e.g. "Du 1 novembre 2026 au 14 novembre 2026". */
function formatSelectedRange(form: ReportFormState): string {
  const start = Date.parse(`${form.startDate}T00:00:00Z`)
  const end = Date.parse(`${form.endDate}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return ""
  return `Du ${rangeFormatter.format(start)} au ${rangeFormatter.format(end)}`
}
