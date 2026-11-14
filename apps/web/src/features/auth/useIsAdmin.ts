import { useCurrentUser } from "./useCurrentUser"

/** True when the signed-in user may change data (directors are read-only). */
export function useIsAdmin(): boolean {
  return useCurrentUser().role === "admin"
}
