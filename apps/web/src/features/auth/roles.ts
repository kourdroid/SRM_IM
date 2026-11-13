/** Application roles allowed to use the supervision dashboard. */
export type Role = "admin" | "director"

export const ROLES: readonly Role[] = ["admin", "director"]

/** French display labels for each role. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  director: "Directeur",
}

/** Type guard for raw role values coming from the database. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}
