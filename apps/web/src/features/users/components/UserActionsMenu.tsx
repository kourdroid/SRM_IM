import { Check, EllipsisVertical, ShieldCheck, Trash, UserX } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ManagedUser } from "@/data/users"

import { ROLE_LABELS, ROLE_OPTIONS, displayName, toUserRole } from "../user-utils"
import type { UserActions } from "../useUserActions"

/** Row actions: change role, approve or reject, and delete (the delete is confirmed by the page). */
export function UserActionsMenu({
  user,
  actions,
  onRequestDelete,
}: {
  user: ManagedUser
  actions: UserActions
  onRequestDelete: (user: ManagedUser) => void
}) {
  const name = displayName(user)
  const busy = actions.busyUserId === user.id

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${name}`} disabled={busy}>
          <EllipsisVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 rounded-xl shadow-soft-lg">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ShieldCheck aria-hidden="true" />
            Changer le rôle
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-48 rounded-xl shadow-soft-lg">
            <DropdownMenuRadioGroup
              value={user.role}
              onValueChange={(value) => {
                const role = toUserRole(value)
                if (role) void actions.changeRole(user, role)
              }}
            >
              {ROLE_OPTIONS.map((role) => (
                <DropdownMenuRadioItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {user.approvalStatus !== "approved" ? (
          <DropdownMenuItem onSelect={() => void actions.setApproval(user, "approved")}>
            <Check aria-hidden="true" />
            Approuver
          </DropdownMenuItem>
        ) : null}
        {user.approvalStatus !== "rejected" ? (
          <DropdownMenuItem onSelect={() => void actions.setApproval(user, "rejected")}>
            <UserX aria-hidden="true" />
            Refuser l'accès
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onRequestDelete(user)}>
          <Trash aria-hidden="true" />
          Supprimer le compte
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
