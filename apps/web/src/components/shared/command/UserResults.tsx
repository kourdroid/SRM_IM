import { CommandGroup, CommandItem } from "@/components/ui/command"
import { useUsers, type ManagedUser } from "@/data/users"
import { displayName, initialsOf, ROLE_LABELS } from "@/features/users/user-utils"
import { normalizeSearchText } from "@/lib/text"

import { CommandRow } from "./CommandRow"

const MAX_RESULTS = 5

/** User matches by name or e-mail for administrators: at most five, in the order the API returns them. */
export function UserResults({ query, onSelect }: { query: string; onSelect: (user: ManagedUser) => void }) {
  const { data, isError } = useUsers()
  const needle = normalizeSearchText(query)
  if (isError || needle === "") return null

  const matches = (data ?? [])
    .filter((user) => normalizeSearchText(`${user.name ?? ""} ${user.email ?? ""}`).includes(needle))
    .slice(0, MAX_RESULTS)
  if (matches.length === 0) return null

  return (
    <CommandGroup heading="Utilisateurs">
      {matches.map((user) => (
        <CommandItem
          key={user.id}
          value={`user:${user.id}`}
          onSelect={() => onSelect(user)}
          className="py-2"
        >
          <CommandRow
            leading={
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
              >
                {initialsOf(user)}
              </span>
            }
            title={displayName(user)}
            description={user.email ?? ROLE_LABELS[user.role]}
            trailing={
              user.email ? <span className="shrink-0 text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span> : undefined
            }
          />
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
