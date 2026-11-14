import { Eye, HardHat, ShieldCheck, type LucideIcon } from "lucide-react"

import type { ApprovalStatus, ManagedUser, UserRole } from "@/data/users"
import { cn } from "@/lib/utils"

import { APPROVAL_LABELS, ROLE_LABELS, initialsOf } from "../user-utils"

const ROLE_ICONS: Record<UserRole, LucideIcon> = {
  field: HardHat,
  admin: ShieldCheck,
  director: Eye,
}

const ROLE_TONES: Record<UserRole, string> = {
  field: "bg-muted text-foreground",
  admin: "bg-primary text-primary-foreground",
  director: "bg-secondary text-secondary-foreground",
}

const APPROVAL_TONES: Record<ApprovalStatus, string> = {
  approved: "bg-success-soft text-success",
  pending: "bg-warning-soft text-warning",
  rejected: "bg-destructive/10 text-destructive",
}

/** Role chip with an icon: field agent, administrator or director. */
export function RoleBadge({ role }: { role: UserRole }) {
  const Icon = ROLE_ICONS[role]

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        ROLE_TONES[role],
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {ROLE_LABELS[role]}
    </span>
  )
}

/** Approval state pill with a dot: approved, pending or rejected. */
export function ApprovalPill({ status }: { status: ApprovalStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        APPROVAL_TONES[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {APPROVAL_LABELS[status]}
    </span>
  )
}

/** Initials chip. Decorative: the name next to it carries the meaning. */
export function UserAvatar({ user }: { user: Pick<ManagedUser, "name" | "email"> }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground"
    >
      {initialsOf(user)}
    </span>
  )
}
