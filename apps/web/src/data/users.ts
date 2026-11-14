import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"

import { cleanLabel } from "@/data/incidents"
import { describeError } from "@/lib/rpc"
import { supabase } from "@/lib/supabase"

/**
 * User administration data layer. It follows the mobile reference (userAdminService.ts): the list comes
 * from the get_admin_users RPC, role and approval changes are direct updates on user_profiles (RLS lets
 * administrators update), and accounts are created or deleted through RPCs. Administrators only.
 */

/** `field` is the field agent ("Agent terrain") role stored in the database. */
export type UserRole = "field" | "admin" | "director"
export type ApprovalStatus = "pending" | "approved" | "rejected"

export type ManagedUser = {
  id: string
  name: string | null
  email: string | null
  role: UserRole
  approvalStatus: ApprovalStatus
}

export type CreateUserInput = {
  email: string
  password: string
  name: string
  role: UserRole
}

/** Minimum password length for an account created by an administrator. */
export const MIN_PASSWORD_LENGTH = 8

/** Every user query key starts with "users", so invalidating it refreshes the whole module. */
export const USERS_QUERY_KEY = ["users"] as const

const USERS_LIST_KEY = [...USERS_QUERY_KEY, "list"] as const

const ROLES: readonly UserRole[] = ["field", "admin", "director"]
const APPROVAL_STATUSES: readonly ApprovalStatus[] = ["pending", "approved", "rejected"]
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type AdminUserRow = {
  id: string
  name: string | null
  role: unknown
  email: string | null
  approval_status: unknown
}

/** Every user, from the get_admin_users RPC. Unknown roles fall back to field, unknown statuses to pending. */
export function useUsers() {
  return useQuery({
    queryKey: USERS_LIST_KEY,
    queryFn: fetchUsers,
  })
}

async function fetchUsers(): Promise<ManagedUser[]> {
  const { data, error } = await supabase.rpc("get_admin_users")
  if (error) throw new Error(`Chargement des utilisateurs impossible : ${describeError(error)}`)

  return ((data ?? []) as AdminUserRow[]).map((row) => ({
    id: row.id,
    name: cleanLabel(row.name) || null,
    email: row.email?.trim() || null,
    role: parseRole(row.role),
    approvalStatus: parseApprovalStatus(row.approval_status),
  }))
}

/** Changes the role of a user (field, admin or director). The row shows the new role at once. */
export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      if (!ROLES.includes(role)) throw new Error("Rôle invalide.")
      await updateProfile(id, { role }, "Mise à jour du rôle impossible")
    },
    onMutate: ({ id, role }) => optimisticUserUpdate(queryClient, id, { role }),
    onError: (_error, _variables, context) => restoreUsers(queryClient, context),
    onSettled: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  })
}

/** Approves or rejects an account (self-service signups start as pending). The badge changes at once. */
export function useUpdateUserApproval() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ApprovalStatus }) => {
      if (!APPROVAL_STATUSES.includes(status)) throw new Error("Statut invalide.")
      await updateProfile(id, { approval_status: status }, "Mise à jour du statut impossible")
    },
    onMutate: ({ id, status }) => optimisticUserUpdate(queryClient, id, { approvalStatus: status }),
    onError: (_error, _variables, context) => restoreUsers(queryClient, context),
    onSettled: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  })
}

/** Cached user list before an optimistic change, restored when the write fails. */
type UsersSnapshot = { previous: ManagedUser[] | undefined }

/** Shows a change to one cached user at once. Cancels in-flight list fetches so they cannot overwrite it. */
async function optimisticUserUpdate(
  queryClient: QueryClient,
  userId: string,
  patch: Partial<Pick<ManagedUser, "role" | "approvalStatus">>,
): Promise<UsersSnapshot> {
  await queryClient.cancelQueries({ queryKey: USERS_QUERY_KEY })
  const previous = queryClient.getQueryData<ManagedUser[]>(USERS_LIST_KEY)
  if (previous) {
    queryClient.setQueryData<ManagedUser[]>(
      USERS_LIST_KEY,
      previous.map((user) => (user.id === userId ? { ...user, ...patch } : user)),
    )
  }
  return { previous }
}

function restoreUsers(queryClient: QueryClient, snapshot: UsersSnapshot | undefined): void {
  if (snapshot?.previous) queryClient.setQueryData<ManagedUser[]>(USERS_LIST_KEY, snapshot.previous)
}

/** Creates an approved account with a temporary password. The RPC enforces the rules and French messages. */
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      // The RPC only accepts field or admin and leaves the profile pending (it was written for the
      // sign-up flow): create a director as field, then set the real role and approve in one update.
      const { data, error } = await supabase.rpc("create_user_by_admin", {
        user_email: input.email.trim().toLowerCase(),
        user_password: input.password,
        user_name: input.name.trim(),
        user_role: input.role === "director" ? "field" : input.role,
      })
      if (error) throw new Error(`Création du compte impossible : ${describeError(error)}`)
      const createdId = (data as { id?: unknown } | null)?.id
      if (typeof createdId !== "string") throw new Error("Compte créé, mais son identifiant est introuvable. Rechargez la liste.")
      await updateProfile(
        createdId,
        { role: input.role, approval_status: "approved" },
        "Compte créé, mais l'activation a échoué. Approuvez-le dans la liste"
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  })
}

/** Deletes the account (auth user and profile) through the admin-only RPC. */
export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      assertUserId(userId)
      const { error } = await supabase.rpc("delete_user_by_admin", { user_id: userId })
      if (error) throw new Error(`Suppression impossible : ${describeError(error)}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  })
}

async function updateProfile(
  userId: string,
  values: { role?: UserRole; approval_status?: ApprovalStatus },
  action: string,
): Promise<void> {
  assertUserId(userId)
  const { data, error } = await supabase
    .from("user_profiles")
    .update(values)
    .eq("id", userId)
    .select("id")
    .maybeSingle()

  if (error) throw new Error(`${action} : ${describeError(error)}`)
  if (!data) throw new Error(`${action} : utilisateur absent ou accès refusé.`)
}

function assertUserId(userId: string): void {
  if (!UUID_PATTERN.test(userId)) throw new Error("Identifiant d'utilisateur invalide.")
}

function parseRole(value: unknown): UserRole {
  return ROLES.find((role) => role === value) ?? "field"
}

function parseApprovalStatus(value: unknown): ApprovalStatus {
  return value === "approved" || value === "rejected" ? value : "pending"
}
