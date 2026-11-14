import { RefreshCw, TriangleExclamationPoint, UserPlus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"

import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { useUsers, type ManagedUser } from "@/data/users"
import { describeError } from "@/lib/rpc"

import { CreateUserDialog } from "./components/CreateUserDialog"
import { PendingRequestsCard } from "./components/PendingRequestsCard"
import { UsersFilterBar } from "./components/UsersFilterBar"
import { UsersKpis } from "./components/UsersKpis"
import { UsersSkeleton } from "./components/UsersSkeleton"
import { UsersTable } from "./components/UsersTable"
import {
  DEFAULT_USER_FILTERS,
  countUsers,
  displayName,
  filterUsers,
  hasActiveUserFilters,
  sortUsers,
  type UserFilters,
} from "./user-utils"
import { useUserActions } from "./useUserActions"

const EMPTY_USERS: ManagedUser[] = []

/**
 * Administration of the accounts: pending requests, KPIs, search and filters, the full user table,
 * account creation and a confirmed deletion. Reserved for administrators by the router.
 */
export function UsersPage() {
  const usersQuery = useUsers()
  const actions = useUserActions()
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_USER_FILTERS)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const recherche = searchParams.get("recherche")
  const nouveau = searchParams.get("nouveau")
  const [appliedRecherche, setAppliedRecherche] = useState<string | null>(null)
  const [appliedNouveau, setAppliedNouveau] = useState(false)

  // URL params are applied during render, comparing against the last applied value, so a
  // navigation to this page while it is mounted updates the state without setState in an effect.
  if (recherche !== appliedRecherche) {
    setAppliedRecherche(recherche)
    if (recherche !== null) setFilters((prev) => ({ ...prev, search: recherche }))
  }
  if ((nouveau === "1") !== appliedNouveau) {
    setAppliedNouveau(nouveau === "1")
    if (nouveau === "1") setCreateOpen(true)
  }

  // Consumed params are removed in one update, since two separate calls would overwrite each other.
  useEffect(() => {
    if (recherche === null && nouveau === null) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete("recherche")
        next.delete("nouveau")
        return next
      },
      { replace: true },
    )
  }, [recherche, nouveau, setSearchParams])

  const users = usersQuery.data ?? EMPTY_USERS
  const counts = useMemo(() => countUsers(users), [users])
  const pending = useMemo(
    () => sortUsers(users.filter((user) => user.approvalStatus === "pending")),
    [users],
  )
  const rows = useMemo(() => sortUsers(filterUsers(users, filters)), [users, filters])

  function requestDelete(user: ManagedUser) {
    setDeleteTarget(user)
    setDeleteOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Utilisateurs"
        description="Demandes d'accès, rôles et comptes de l'application."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus aria-hidden="true" />
            Nouvel utilisateur
          </Button>
        }
      />

      {usersQuery.isPending ? (
        <UsersSkeleton />
      ) : usersQuery.isError ? (
        <EmptyState
          icon={TriangleExclamationPoint}
          title="Impossible de charger les utilisateurs"
          description={describeError(usersQuery.error)}
          action={
            <Button variant="secondary" onClick={() => void usersQuery.refetch()}>
              <RefreshCw aria-hidden="true" />
              Réessayer
            </Button>
          }
        />
      ) : (
        <>
          <UsersKpis counts={counts} />

          {pending.length > 0 ? <PendingRequestsCard users={pending} actions={actions} /> : null}

          <div className="flex flex-col gap-3">
            <UsersFilterBar
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(DEFAULT_USER_FILTERS)}
            />
            <UsersTable
              rows={rows}
              totalCount={users.length}
              actions={actions}
              onRequestDelete={requestDelete}
              onResetFilters={() => setFilters(DEFAULT_USER_FILTERS)}
              hasActiveFilters={hasActiveUserFilters(filters)}
            />
          </div>
        </>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer ce compte ?"
        description={
          deleteTarget
            ? `Le compte de ${displayName(deleteTarget)} sera supprimé définitivement. Cette action est irréversible.`
            : undefined
        }
        confirmLabel="Supprimer le compte"
        destructive
        onConfirm={async () => {
          if (deleteTarget) await actions.removeAccount(deleteTarget)
        }}
      />
    </div>
  )
}
