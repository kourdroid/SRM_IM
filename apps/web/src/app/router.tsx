import { createBrowserRouter, Navigate } from "react-router"

import { AppShell } from "@/components/shared/AppShell"
import { ComingSoonPage } from "@/components/shared/ComingSoonPage"
import { RouteErrorPage } from "@/components/shared/RouteErrorPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { RequireAuth } from "@/features/auth/RequireAuth"
import { RequireRole } from "@/features/auth/RequireRole"

import { MODULES } from "./modules"

// Every 'soon' module gets a route rendering the generic placeholder.
const comingSoonRoutes = MODULES.filter((module) => module.status === "soon").map((module) => ({
  path: module.path.slice(1),
  element: <ComingSoonPage module={module} />,
}))

/** Application router: public login, then the authenticated shell with feature pages. */
export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            lazy: async () => ({ Component: (await import("@/features/overview/OverviewPage")).OverviewPage }),
          },
          {
            path: "carte",
            lazy: async () => ({ Component: (await import("@/features/map/MapPage")).MapPage }),
          },
          {
            path: "incidents",
            lazy: async () => ({ Component: (await import("@/features/incidents/IncidentsPage")).IncidentsPage }),
          },
          {
            path: "notifications",
            lazy: async () => ({ Component: (await import("@/features/notifications/NotificationsPage")).NotificationsPage }),
          },
          {
            path: "postes",
            lazy: async () => ({ Component: (await import("@/features/network/NetworkPage")).NetworkPage }),
          },
          {
            path: "admin/rapports",
            lazy: async () => ({ Component: (await import("@/features/reports/ReportsPage")).ReportsPage }),
          },
          {
            path: "admin/parametres",
            lazy: async () => ({ Component: (await import("@/features/settings/SettingsPage")).SettingsPage }),
          },
          {
            // Reference data and user management change what field agents see: administrators only.
            element: <RequireRole role="admin" />,
            children: [
              {
                path: "referentiels/communes",
                lazy: async () => ({ Component: (await import("@/features/references/ReferencesPage")).ReferencesPage }),
              },
              {
                path: "referentiels/materiels",
                lazy: async () => ({ Component: (await import("@/features/references/MaterialsPage")).MaterialsPage }),
              },
              {
                path: "admin/utilisateurs",
                lazy: async () => ({ Component: (await import("@/features/users/UsersPage")).UsersPage }),
              },
            ],
          },
          ...comingSoonRoutes,
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
])
