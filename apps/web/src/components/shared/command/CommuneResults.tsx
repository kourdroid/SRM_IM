import { MapPinned } from "lucide-react"

import { CommandGroup, CommandItem } from "@/components/ui/command"
import type { Commune } from "@/data/incidents"

import { CommandRow } from "./CommandRow"

/** Commune matches for the command palette, one selectable row per commune in the order given. */
export function CommuneResults({
  communes,
  onSelect,
}: {
  communes: readonly Commune[]
  onSelect: (commune: Commune) => void
}) {
  if (communes.length === 0) return null

  return (
    <CommandGroup heading="Communes">
      {communes.map((commune) => (
        <CommandItem
          key={commune.id}
          value={`commune:${commune.id}`}
          onSelect={() => onSelect(commune)}
          className="py-2"
        >
          <CommandRow
            leading={
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <MapPinned aria-hidden="true" />
              </span>
            }
            title={commune.name}
            description="Commune"
          />
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
