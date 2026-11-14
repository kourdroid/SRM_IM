import { Search, Users } from "lucide-react"

import { EmptyState } from "@/components/shared/EmptyState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ManagedUser } from "@/data/users"
import { formatNumber } from "@/lib/format"

import { displayName } from "../user-utils"
import type { UserActions } from "../useUserActions"

import { ApprovalPill, RoleBadge, UserAvatar } from "./UserBadges"
import { UserActionsMenu } from "./UserActionsMenu"

/**
 * All users in a soft card. The table keeps its width and scrolls inside the card on phones.
 * The administrator's own row shows a "Vous" marker instead of actions.
 */
export function UsersTable({
  rows,
  totalCount,
  actions,
  onRequestDelete,
  onResetFilters,
  hasActiveFilters,
}: {
  rows: ManagedUser[]
  totalCount: number
  actions: UserActions
  onRequestDelete: (user: ManagedUser) => void
  onResetFilters: () => void
  hasActiveFilters: boolean
}) {
  if (totalCount === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Aucun utilisateur enregistré"
        description="Créez un compte pour donner accès à l'application."
      />
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Aucun utilisateur ne correspond à ces filtres"
        action={
          hasActiveFilters ? (
            <Button variant="secondary" onClick={onResetFilters}>
              Réinitialiser
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl bg-card shadow-soft">
        <Table className="min-w-[520px] md:min-w-[760px]">
          <caption className="sr-only">
            Liste des utilisateurs, {formatNumber(rows.length)} résultat{rows.length > 1 ? "s" : ""}
          </caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nom</TableHead>
              <TableHead className="hidden md:table-cell">Adresse e-mail</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-px text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((user) => {
              const self = actions.isSelf(user)

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={user} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{displayName(user)}</span>
                        {user.email ? (
                          <span className="truncate text-xs text-muted-foreground md:hidden">{user.email}</span>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {user.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    <ApprovalPill status={user.approvalStatus} />
                  </TableCell>
                  <TableCell className="w-px text-right">
                    {self ? (
                      <Badge variant="secondary">Vous</Badge>
                    ) : (
                      <UserActionsMenu user={user} actions={actions} onRequestDelete={onRequestDelete} />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="px-1 text-sm text-muted-foreground tabular-nums" aria-live="polite">
        {formatNumber(rows.length)} sur {formatNumber(totalCount)} utilisateur{totalCount > 1 ? "s" : ""}
      </p>
    </div>
  )
}
