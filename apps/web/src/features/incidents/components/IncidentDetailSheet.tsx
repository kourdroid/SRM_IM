import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"

import { NetworkBadge } from "@/components/shared/NetworkBadge"
import { StatusPill } from "@/components/shared/StatusPill"
import { Button } from "@/components/ui/button"
import { SheetContent, SheetDescription, SheetHeader, SheetTitle, Sheet } from "@/components/ui/sheet"
import { useIsAdmin } from "@/features/auth/useIsAdmin"
import { isLateEntry, type Incident } from "@/data/incidents"
import { formatDateTime } from "@/lib/format"

import {
  formatCoordinate,
  formatDuration,
  googleMapsPlaceUrl,
  hasPosition,
} from "../table-utils"
import { IncidentAdminActions } from "./actions/IncidentAdminActions"

/**
 * Side panel with the full incident. Admins get the action buttons (edit, materials, close, reopen,
 * archive); directors see the same details read-only. `incident` is undefined while loading or when the
 * incident is not in the current filter selection.
 */
export function IncidentDetailSheet({
  open,
  incident,
  isLoading,
  onOpenChange,
}: {
  open: boolean
  incident: Incident | undefined
  isLoading: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-0 bg-card p-0 shadow-soft-lg data-[side=right]:border-0 sm:max-w-md data-[side=right]:sm:max-w-md"
      >
        {incident ? (
          <IncidentDetails incident={incident} onArchived={() => onOpenChange(false)} />
        ) : (
          <div className="flex flex-1 flex-col gap-2 p-6 pt-14">
            <SheetHeader className="p-0">
              <SheetTitle>Détail de l'incident</SheetTitle>
              <SheetDescription>
                {isLoading
                  ? "Chargement de l'incident…"
                  : "Cet incident ne figure pas dans la sélection actuelle des filtres."}
              </SheetDescription>
            </SheetHeader>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function IncidentDetails({ incident, onArchived }: { incident: Incident; onArchived: () => void }) {
  const isAdmin = useIsAdmin()
  const late = isLateEntry(incident)
  const position = hasPosition(incident)
  const locationLabel = incident.village ? `${incident.commune} · ${incident.village}` : incident.commune

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="gap-2 p-6 pt-14 pb-4">
        <div className="flex items-center gap-2">
          <NetworkBadge network={incident.network} />
        </div>
        <SheetTitle className="text-lg leading-snug">{incident.incidentType}</SheetTitle>
        <SheetDescription>{locationLabel}</SheetDescription>
      </SheetHeader>

      {isAdmin ? (
        <div className="px-6 pb-4">
          <IncidentAdminActions incident={incident} onArchived={onArchived} />
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <dl className="flex flex-col gap-2">
          <DetailRow label="Départ HTA">{incident.departHta ?? "—"}</DetailRow>
          <DetailRow label="Déclaré">{formatDateTime(incident.date)}</DetailRow>
          <DetailRow label="Saisi">
            {formatDateTime(incident.createdAt)}
            {late ? (
              <span className="mt-1 block text-xs font-medium text-warning">
                Saisi après coup, {formatDuration(incident.date, incident.createdAt)} après l'incident
              </span>
            ) : null}
          </DetailRow>
          <DetailRow label="Clôturé">
            {incident.closedAt ? (
              <>
                {formatDateTime(incident.closedAt)}
                <span className="mt-1 block text-xs text-muted-foreground">
                  Durée : {formatDuration(incident.date, incident.closedAt)}
                </span>
              </>
            ) : (
              "—"
            )}
          </DetailRow>
          <DetailRow label="Statut">
            <StatusPill status={incident.status} />
          </DetailRow>
          <DetailRow label="Réclamation">{incident.reclamation ? "Oui" : "Non"}</DetailRow>
          {incident.reclamation ? (
            <>
              <DetailRow label="Nom du réclamant">{incident.reclamationName ?? "Non spécifié"}</DetailRow>
              <DetailRow label="Déposée par">{incident.reclamationBy ?? "Non spécifié"}</DetailRow>
            </>
          ) : null}
          <DetailRow label="Agent">{incident.agentName ?? "—"}</DetailRow>
          <DetailRow label="Matériel utilisé">{incident.equipmentUsed || "Non renseigné"}</DetailRow>
          <DetailBlock label="Description">
            {incident.description ?? <span className="text-muted-foreground">Aucune description fournie.</span>}
          </DetailBlock>
          <DetailRow label="Position">
            {position && incident.latitude !== null && incident.longitude !== null ? (
              <span className="flex flex-col items-end gap-1">
                <span className="tabular-nums">
                  {formatCoordinate(incident.latitude)}, {formatCoordinate(incident.longitude)}
                </span>
                <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                  <a href={googleMapsPlaceUrl(incident.latitude, incident.longitude)} target="_blank" rel="noreferrer">
                    Ouvrir dans Google Maps
                    <ExternalLink aria-hidden="true" />
                  </a>
                </Button>
              </span>
            ) : (
              "Non relevée"
            )}
          </DetailRow>
        </dl>
      </div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 px-3.5 py-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium tabular-nums">{children}</dd>
    </div>
  )
}

/** Full-width variant of DetailRow for long text, such as the description. */
function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 px-3.5 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm leading-relaxed whitespace-pre-line">{children}</dd>
    </div>
  )
}
