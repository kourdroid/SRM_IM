import { Navigate, Outlet, useLocation } from "react-router"

import { FullPageLoader } from "@/components/shared/FullPageLoader"

import { useAuth } from "./auth-context"

/** Route guard: renders children only for an authorized admin or director. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === "loading" || status === "checking") {
    return <FullPageLoader label="Vérification de la session…" />
  }

  if (status !== "authorized") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
