import { NetworkBadge } from "@/components/shared/NetworkBadge"
import { StatusPill } from "@/components/shared/StatusPill"
import { CommandGroup, CommandItem } from "@/components/ui/command"
import type { IncidentSearchHit } from "@/data/search"
import { formatDate } from "@/lib/format"

import { CommandRow } from "./CommandRow"

/** Incident matches for the command palette: a loading row while fetching, then one row per incident in the order given. */
export function IncidentResults({
  active,
  isFetching,
  hits,
  onSelect,
}: {
  active: boolean
  isFetching: boolean
  hits: readonly IncidentSearchHit[] | undefined
  onSelect: (hit: IncidentSearchHit) => void
}) {
  if (!active) return null

  const list = hits ?? []
  if (!isFetching && list.length === 0) return null

  return (
    <>
      {isFetching ? (
        <div role="status" className="px-2 py-1.5 text-xs text-muted-foreground">
          Recherche…
        </div>
      ) : null}
      {list.length > 0 ? (
        <CommandGroup heading="Incidents">
          {list.map((hit) => (
            <CommandItem key={hit.id} value={`incident:${hit.id}`} onSelect={() => onSelect(hit)} className="py-2">
              <CommandRow
                leading={<NetworkBadge network={hit.network} />}
                title={incidentTitle(hit)}
                description={
                  <>
                    {hit.commune} · <span className="tabular-nums">{formatDate(hit.date)}</span>
                  </>
                }
                trailing={<StatusPill status={hit.status} />}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
    </>
  )
}

/** Incident type and village joined with a middle dot, skipping whichever is empty. */
function incidentTitle(hit: IncidentSearchHit): string {
  const parts = [hit.incidentType.trim(), hit.village.trim()].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : "Incident"
}
