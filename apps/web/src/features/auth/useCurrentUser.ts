import type { CurrentUser } from "./auth-context"
import { useAuth } from "./auth-context"

/** Returns the authorized user ({ id, name, role }); only valid inside RequireAuth. */
export function useCurrentUser(): CurrentUser {
  const { user } = useAuth()
  if (!user) {
    throw new Error("useCurrentUser doit être utilisé dans une route authentifiée.")
  }
  return user
}
