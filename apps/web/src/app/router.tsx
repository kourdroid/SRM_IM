import { createBrowserRouter, Navigate } from "react-router"

import { AppShell } from "@/components/shared/AppShell"
import { ComingSoonPage } from "@/components/shared/ComingSoonPage"
import { RouteErrorPage } from "@/components/shared/RouteErrorPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { RequireAuth } from "@/features/auth/RequireAuth"
import { RequireRole } from "@/features/auth/RequireRole"

import { MODULES } from "./modules"
import { pageLoaders } from "./preload"

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
            lazy: async () => ({ Component: (await pageLoaders.overview()).OverviewPage }),
          },
          {
            path: "carte",
            lazy: async () => ({ Component: (await pageLoaders.map()).MapPage }),
          },
          {
            path: "incidents",
            lazy: async () => ({ Component: (await pageLoaders.incidents()).IncidentsPage }),
          },
          {
            path: "notifications",
            lazy: async () => ({ Component: (await pageLoaders.notifications()).NotificationsPage }),
          },
          {
            path: "postes",
            lazy: async () => ({ Component: (await pageLoaders.network()).NetworkPage }),
          },
          {
            path: "admin/rapports",
            lazy: async () => ({ Component: (await pageLoaders.reports()).ReportsPage }),
          },
          {
            path: "admin/parametres",
            lazy: async () => ({ Component: (await pageLoaders.settings()).SettingsPage }),
          },
          {
            // Reference data and user management change what field agents see: administrators only.
            element: <RequireRole role="admin" />,
            children: [
              {
                path: "referentiels/communes",
                lazy: async () => ({ Component: (await pageLoaders.communes()).ReferencesPage }),
              },
              {
                path: "referentiels/materiels",
                lazy: async () => ({ Component: (await pageLoaders.materials()).MaterialsPage }),
              },
              {
                path: "admin/utilisateurs",
                lazy: async () => ({ Component: (await pageLoaders.users()).UsersPage }),
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
