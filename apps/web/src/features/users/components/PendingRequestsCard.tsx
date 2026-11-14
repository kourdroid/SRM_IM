import { Check, X } from "lucide-react"

import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import type { ManagedUser } from "@/data/users"

import { displayName } from "../user-utils"
import type { UserActions } from "../useUserActions"

import { UserAvatar } from "./UserBadges"

/** Self-service signups waiting for a decision. Shown only when at least one account is pending. */
export function PendingRequestsCard({ users, actions }: { users: ManagedUser[]; actions: UserActions }) {
  const count = users.length

  return (
    <SectionCard
      title="Demandes en attente"
      description={`${count} ${count === 1 ? "compte attend" : "comptes attendent"} une décision avant d'accéder à l'application.`}
    >
      <ul className="flex flex-col gap-2">
        {users.map((user) => {
          const name = displayName(user)
          const busy = actions.busyUserId === user.id

          return (
            <li
              key={user.id}
              className="flex flex-col gap-3 rounded-lg bg-muted/60 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar user={user} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email ?? "Aucune adresse e-mail"}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  aria-label={`Approuver ${name}`}
                  disabled={busy}
                  onClick={() => void actions.setApproval(user, "approved")}
                >
                  <Check aria-hidden="true" />
                  Approuver
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  aria-label={`Refuser ${name}`}
                  disabled={busy}
                  onClick={() => void actions.setApproval(user, "rejected")}
                >
                  <X aria-hidden="true" />
                  Refuser
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}
