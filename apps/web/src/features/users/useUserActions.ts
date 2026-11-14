import { toast } from "sonner"

import { useCurrentUser } from "@/features/auth/useCurrentUser"
import {
  useDeleteUser,
  useUpdateUserApproval,
  useUpdateUserRole,
  type ApprovalStatus,
  type ManagedUser,
  type UserRole,
} from "@/data/users"
import { describeError } from "@/lib/rpc"

import { ROLE_LABELS, SELF_ACCOUNT_MESSAGE, displayName } from "./user-utils"

/**
 * Row and card actions for the users page. Each action reports success or failure with a French toast
 * and refreshes the list through the mutation hooks. The signed-in administrator can never demote,
 * reject or delete their own account.
 */
export function useUserActions() {
  const currentUser = useCurrentUser()
  const updateRole = useUpdateUserRole()
  const updateApproval = useUpdateUserApproval()
  const deleteUser = useDeleteUser()

  const isSelf = (user: Pick<ManagedUser, "id">) => user.id === currentUser.id

  const busyUserId =
    (updateRole.isPending ? updateRole.variables?.id : undefined) ??
    (updateApproval.isPending ? updateApproval.variables?.id : undefined) ??
    null

  async function changeRole(user: ManagedUser, role: UserRole): Promise<void> {
    if (user.role === role) return
    if (isSelf(user)) {
      toast.error(SELF_ACCOUNT_MESSAGE)
      return
    }
    try {
      await updateRole.mutateAsync({ id: user.id, role })
      toast.success(`Rôle de ${displayName(user)} mis à jour : ${ROLE_LABELS[role]}.`)
    } catch (error) {
      toast.error(describeError(error))
    }
  }

  async function setApproval(user: ManagedUser, status: ApprovalStatus): Promise<void> {
    if (user.approvalStatus === status) return
    if (isSelf(user)) {
      toast.error(SELF_ACCOUNT_MESSAGE)
      return
    }
    try {
      await updateApproval.mutateAsync({ id: user.id, status })
      const outcome = status === "approved" ? "approuvé" : status === "rejected" ? "refusé" : "remis en attente"
      toast.success(`Compte de ${displayName(user)} ${outcome}.`)
    } catch (error) {
      toast.error(describeError(error))
    }
  }

  /** Deletes the account. Rethrows on failure so the confirmation dialog stays open for a retry. */
  async function removeAccount(user: ManagedUser): Promise<void> {
    if (isSelf(user)) {
      toast.error(SELF_ACCOUNT_MESSAGE)
      throw new Error(SELF_ACCOUNT_MESSAGE)
    }
    try {
      await deleteUser.mutateAsync(user.id)
      toast.success(`Compte de ${displayName(user)} supprimé.`)
    } catch (error) {
      toast.error(describeError(error))
      throw error
    }
  }

  return { isSelf, busyUserId, changeRole, setApproval, removeAccount }
}

export type UserActions = ReturnType<typeof useUserActions>
