import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import { Link, useSearchParams } from "react-router"

import { NetworkBadge } from "@/components/shared/NetworkBadge"
import { StatusPill } from "@/components/shared/StatusPill"
import { Button } from "@/components/ui/button"
import { isLateEntry } from "@/data/incidents"
import type { PositionedIncident } from "@/features/map/geo"
import { APP_LOCALE, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const coordinateFormatter = new Intl.NumberFormat(APP_LOCALE, {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
})

/** Side panel: details of the selected incident, or a hint with the legend, then the accessible list. */
export function IncidentDetailPanel({
  incident,
  recent,
  onSelect,
  onClear,
  className,
}: {
  incident: PositionedIncident | null
  recent: PositionedIncident[]
  onSelect: (id: string) => void
  onClear: () => void
  className?: string
}) {
  return (
    <div className={cn("flex min-h-0 flex-col gap-6 overflow-y-auto p-5", className)}>
      {incident ? (
        <IncidentDetails incident={incident} onClear={onClear} />
      ) : (
        <section aria-labelledby="map-hint-title" className="flex flex-col gap-3">
          <h2 id="map-hint-title" className="text-lg font-semibold">
            Aucun incident sélectionné
          </h2>
          <p className="text-sm text-muted-foreground">
            Cliquez sur un point de la carte, ou choisissez un incident dans la liste ci-dessous.
          </p>
          <Legend />
        </section>
      )}

      <RecentList recent={recent} selectedId={incident?.id ?? null} onSelect={onSelect} />
    </div>
  )
}

function IncidentDetails({ incident, onClear }: { incident: PositionedIncident; onClear: () => void }) {
  const [params] = useSearchParams()
  const listParams = new URLSearchParams(params)
  listParams.set("incident", incident.id)

  const late = isLateEntry(incident)
  const place = [incident.commune, incident.village].filter(Boolean).join(" · ")
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${incident.latitude},${incident.longitude}`

  return (
    <article aria-labelledby="incident-detail-title" className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 pr-10">
        <div className="flex items-center gap-2">
          <NetworkBadge network={incident.network} />
        </div>
        <h2 id="incident-detail-title" className="text-lg leading-tight font-semibold">
          {incident.incidentType || "Incident"}
        </h2>
        {place ? <p className="text-sm text-muted-foreground">{place}</p> : null}
      </header>

      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-sm">
        <DetailRow label="Déclaré">
          <span className="tabular-nums">{formatDateTime(incident.date)}</span>
        </DetailRow>
        <DetailRow label="Saisi">
          <span className="flex flex-wrap items-center gap-2 tabular-nums">
            {formatDateTime(incident.createdAt)}
            {late ? (
              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                saisi après coup
              </span>
            ) : null}
          </span>
        </DetailRow>
        <DetailRow label="Statut">
          <StatusPill status={incident.status} />
        </DetailRow>
        <DetailRow label="Agent">
          <span>{incident.agentName ?? "—"}</span>
        </DetailRow>
        {incident.departHta ? (
          <DetailRow label="Départ HTA">
            <span>{incident.departHta}</span>
          </DetailRow>
        ) : null}
        <DetailRow label="Position">
          <span className="tabular-nums">
            {coordinateFormatter.format(incident.latitude)}, {coordinateFormatter.format(incident.longitude)}
          </span>
        </DetailRow>
      </dl>

      <div className="flex flex-col gap-2">
        <Button asChild>
          <Link to={`/incidents?${listParams.toString()}`}>Ouvrir dans la liste</Link>
        </Button>
        <Button asChild variant="secondary">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
            Itinéraire Google Maps
            <ExternalLink aria-hidden="true" />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
        </Button>
        <Button variant="ghost" onClick={onClear}>
          Fermer le détail
        </Button>
      </div>
    </article>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function LegendItem({ swatch, label, description }: { swatch: ReactNode; label: string; description: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex w-8 shrink-0 justify-center">{swatch}</span>
      <span>
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground"> : {description}</span>
      </span>
    </li>
  )
}

function Legend() {
  return (
    <ul aria-label="Légende de la carte" className="flex flex-col gap-2.5 text-sm">
      <LegendItem swatch={<span aria-hidden="true" className="size-3 rounded-full bg-bt" />} label="BT" description="basse tension" />
      <LegendItem swatch={<span aria-hidden="true" className="size-3 rounded-full bg-mt" />} label="MT" description="moyenne tension" />
      <LegendItem
        swatch={
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-full bg-navy text-[10px] font-semibold text-white dark:bg-gray-700"
          >
            12
          </span>
        }
        label="Groupe"
        description="plusieurs incidents proches, cliquer pour zoomer"
      />
      <LegendItem
        swatch={<span aria-hidden="true" className="h-3 w-7 rounded-full bg-linear-to-r from-amber-400/40 via-orange-500 to-red-700" />}
        label="Densité"
        description="zones où les incidents se concentrent (mode Densité)"
      />
    </ul>
  )
}

function RecentList({
  recent,
  selectedId,
  onSelect,
}: {
  recent: PositionedIncident[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section aria-labelledby="recent-title" className="flex flex-col gap-2">
      <h3 id="recent-title" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Dernières positions
      </h3>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune position à afficher pour ces filtres.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {recent.map((item) => {
            const active = item.id === selectedId
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "bg-navy text-white dark:bg-foreground dark:text-background" : "hover:bg-muted",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn("size-2.5 shrink-0 rounded-full", item.network === "MT" ? "bg-mt" : "bg-bt")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.network} · {item.incidentType || "Incident"}
                    </span>
                    <span className={cn("block truncate text-xs", active ? "opacity-80" : "text-muted-foreground")}>
                      {[item.commune, formatDateTime(item.date)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
