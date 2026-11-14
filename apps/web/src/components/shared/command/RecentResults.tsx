import { NetworkBadge } from "@/components/shared/NetworkBadge"
import { CommandGroup, CommandItem } from "@/components/ui/command"
import type { RecentIncident } from "@/lib/recentIncidents"

import { CommandRow } from "./CommandRow"

/** Recently opened incidents for the empty palette, one row per entry in the order given; renders nothing when empty. */
export function RecentResults({
  entries,
  onSelect,
}: {
  entries: readonly RecentIncident[]
  onSelect: (entry: RecentIncident) => void
}) {
  if (entries.length === 0) return null

  return (
    <CommandGroup heading="Récents">
      {entries.map((entry) => (
        <CommandItem key={entry.id} value={`recent:${entry.id}`} onSelect={() => onSelect(entry)} className="py-2">
          <CommandRow leading={<NetworkBadge network={entry.network} />} title={entry.label} />
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
