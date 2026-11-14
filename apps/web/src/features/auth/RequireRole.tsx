import { Navigate, Outlet } from "react-router"

import type { Role } from "./roles"
import { useCurrentUser } from "./useCurrentUser"

/** Renders the nested routes only for the given role; everyone else goes back to the overview. */
export function RequireRole({ role }: { role: Role }) {
  const user = useCurrentUser()
  if (user.role !== role) return <Navigate to="/" replace />
  return <Outlet />
}

