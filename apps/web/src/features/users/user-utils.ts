import type { ApprovalStatus, ManagedUser, UserRole } from "@/data/users"
import { normalizeSearchText } from "@/lib/text"

export { normalizeSearchText } from "@/lib/text"

/** French labels for the three roles. Field agents are "Agent terrain" here, not "Terrain". */
export const ROLE_LABELS: Record<UserRole, string> = {
  field: "Agent terrain",
  admin: "Administrateur",
  director: "Directeur",
}

/** Display order for role menus and filters. */
export const ROLE_OPTIONS: readonly UserRole[] = ["field", "admin", "director"]

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  approved: "Approuvé",
  pending: "En attente",
  rejected: "Refusé",
}

/** Display order for status filters. */
export const APPROVAL_OPTIONS: readonly ApprovalStatus[] = ["approved", "pending", "rejected"]

export const SELF_ACCOUNT_MESSAGE = "Vous ne pouvez pas modifier votre propre compte."

export type UserFilters = {
  search: string
  role: UserRole | "all"
  status: ApprovalStatus | "all"
}

export const DEFAULT_USER_FILTERS: UserFilters = { search: "", role: "all", status: "all" }

export type UserCounts = {
  total: number
  approved: number
  pending: number
  field: number
  admin: number
  director: number
}

/** Narrows a select value to a known role, or null. */
export function toUserRole(value: string): UserRole | null {
  return ROLE_OPTIONS.find((role) => role === value) ?? null
}

/** Narrows a select value to a known approval status, or null. */
export function toApprovalStatus(value: string): ApprovalStatus | null {
  return APPROVAL_OPTIONS.find((status) => status === value) ?? null
}

/** Name when known, otherwise the e-mail address, otherwise a neutral label. */
export function displayName(user: Pick<ManagedUser, "name" | "email">): string {
  return user.name?.trim() || user.email || "Utilisateur sans nom"
}

/** Up to two letters for the avatar: first and last name initials, or the first letters of one name. */
export function initialsOf(user: Pick<ManagedUser, "name" | "email">): string {
  const parts = (user.name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (user.email?.charAt(0) || "?").toUpperCase()
}

/** True when any filter narrows the list. */
export function hasActiveUserFilters(filters: UserFilters): boolean {
  return filters.search.trim() !== "" || filters.role !== "all" || filters.status !== "all"
}

/** Keeps users matching the role, the status and every word of the search (name or e-mail). */
export function filterUsers(users: readonly ManagedUser[], filters: UserFilters): ManagedUser[] {
  const tokens = normalizeSearchText(filters.search).split(" ").filter(Boolean)

  return users.filter((user) => {
    if (filters.role !== "all" && user.role !== filters.role) return false
    if (filters.status !== "all" && user.approvalStatus !== filters.status) return false
    if (tokens.length === 0) return true

    const haystack = normalizeSearchText([user.name ?? "", user.email ?? ""].join(" "))
    return tokens.every((token) => haystack.includes(token))
  })
}

const STATUS_RANK: Record<ApprovalStatus, number> = { pending: 0, approved: 1, rejected: 2 }

/** Pending accounts first (they need a decision), then by name. */
export function sortUsers(users: readonly ManagedUser[]): ManagedUser[] {
  return [...users].sort(
    (a, b) =>
      STATUS_RANK[a.approvalStatus] - STATUS_RANK[b.approvalStatus] ||
      displayName(a).localeCompare(displayName(b), "fr", { sensitivity: "base", numeric: true }),
  )
}

export function countUsers(users: readonly ManagedUser[]): UserCounts {
  const counts: UserCounts = { total: users.length, approved: 0, pending: 0, field: 0, admin: 0, director: 0 }
  for (const user of users) {
    counts[user.role] += 1
    if (user.approvalStatus === "approved") counts.approved += 1
    if (user.approvalStatus === "pending") counts.pending += 1
  }
  return counts
}
