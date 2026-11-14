/**
 * Page chunk loaders shared by the router and the sidebar. The router's lazy routes and the sidebar prefetch
 * call these same functions with the same import specifiers, so each page is one chunk and is fetched once.
 */
export const pageLoaders = {
  overview: () => import("@/features/overview/OverviewPage"),
  map: () => import("@/features/map/MapPage"),
  incidents: () => import("@/features/incidents/IncidentsPage"),
  notifications: () => import("@/features/notifications/NotificationsPage"),
  network: () => import("@/features/network/NetworkPage"),
  reports: () => import("@/features/reports/ReportsPage"),
  settings: () => import("@/features/settings/SettingsPage"),
  communes: () => import("@/features/references/ReferencesPage"),
  materials: () => import("@/features/references/MaterialsPage"),
  users: () => import("@/features/users/UsersPage"),
} as const

/** Route path (as in the module registry) to the loader of its page. */
const ROUTE_LOADERS = new Map<string, () => Promise<unknown>>([
  ["/", pageLoaders.overview],
  ["/carte", pageLoaders.map],
  ["/incidents", pageLoaders.incidents],
  ["/notifications", pageLoaders.notifications],
  ["/postes", pageLoaders.network],
  ["/admin/rapports", pageLoaders.reports],
  ["/admin/parametres", pageLoaders.settings],
  ["/referentiels/communes", pageLoaders.communes],
  ["/referentiels/materiels", pageLoaders.materials],
  ["/admin/utilisateurs", pageLoaders.users],
])

/** Paths whose chunk has been requested, so each one is fetched at most once. */
const requestedRoutes = new Set<string>()

/** Starts loading the page chunk of a route. Repeated calls are no-ops; a failed load can be retried. */
export function preloadRoute(path: string): void {
  const load = ROUTE_LOADERS.get(path)
  if (!load || requestedRoutes.has(path)) return
  requestedRoutes.add(path)
  void load().catch(() => {
    requestedRoutes.delete(path)
  })
}
