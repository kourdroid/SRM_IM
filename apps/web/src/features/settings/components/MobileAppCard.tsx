import { RefreshCw, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"

import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAppRelease } from "@/data/settings"

import { SettingsRow } from "./SettingsRow"

/** Read-only view of the release row the mobile app checks at startup. */
export function MobileAppCard() {
  const query = useAppRelease()

  let body: ReactNode
  if (query.isPending) {
    body = (
      <div role="status" aria-label="Chargement de la configuration mobile" className="flex flex-col gap-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    )
  } else if (query.isError) {
    body = (
      <div className="flex flex-col items-start gap-3 text-sm">
        <p className="flex items-center gap-2 text-muted-foreground">
          <TriangleAlert className="size-4" aria-hidden="true" />
          {query.error instanceof Error ? query.error.message : "Configuration indisponible."}
        </p>
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
          <RefreshCw aria-hidden="true" />
          Réessayer
        </Button>
      </div>
    )
  } else if (!query.data) {
    body = <p className="text-sm text-muted-foreground">Aucune configuration publiée.</p>
  } else {
    const release = query.data
    body = (
      <dl className="flex flex-col text-sm tabular-nums">
        <SettingsRow label="Dernière version">{release.latestVersion || "—"}</SettingsRow>
        <SettingsRow label="Version minimale acceptée">{release.minSupportedVersion || "—"}</SettingsRow>
        <SettingsRow label="Fiche Android">
          {release.storeUrl ? (
            <a
              href={release.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Ouvrir la fiche
            </a>
          ) : (
            <span className="text-muted-foreground">Aucun lien configuré</span>
          )}
        </SettingsRow>
        {release.message ? <SettingsRow label="Message">{release.message}</SettingsRow> : null}
      </dl>
    )
  }

  return (
    <SectionCard title="Application mobile" description="Versions que l'application des agents vérifie au démarrage.">
      {body}
      <p className="text-xs text-muted-foreground">Modifiable par le développeur.</p>
    </SectionCard>
  )
}
