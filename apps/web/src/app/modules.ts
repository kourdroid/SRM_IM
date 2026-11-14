import {
  Bell,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  Map as MapIcon,
  MapPinned,
  PlugZap,
  Settings,
  TriangleExclamationPoint,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import type { Role } from "@/features/auth/roles"

export type { Role } from "@/features/auth/roles"

/** 'ready' modules have a page; 'soon' modules are shown disabled with a "Bientôt" pill. */
export type ModuleStatus = "ready" | "soon"

/** One navigable entry of the dashboard (drives sidebar, routes and command palette). */
export type ModuleItem = {
  id: string
  label: string
  icon: LucideIcon
  path: string
  status: ModuleStatus
  roles: Role[]
  badge?: string
}

/** A labelled group of modules in the sidebar. */
export type ModuleSection = {
  id: string
  label: string
  items: ModuleItem[]
}

const ALL_ROLES: Role[] = ["admin", "director"]
const ADMIN_ONLY: Role[] = ["admin"]

/** Single source of truth for navigation, routes and the command palette. */
export const MODULE_SECTIONS: ModuleSection[] = [
  {
    id: "supervision",
    label: "Supervision",
    items: [
      { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard, path: "/", status: "ready", roles: ALL_ROLES },
      { id: "map", label: "Carte", icon: MapIcon, path: "/carte", status: "ready", roles: ALL_ROLES },
      { id: "incidents", label: "Incidents", icon: TriangleExclamationPoint, path: "/incidents", status: "ready", roles: ALL_ROLES },
      { id: "notifications", label: "Notifications", icon: Bell, path: "/notifications", status: "ready", roles: ALL_ROLES },
    ],
  },
  {
    id: "reseau",
    label: "Réseau",
    items: [
      { id: "load-control", label: "Contrôle de charge", icon: Gauge, path: "/charge", status: "soon", roles: ALL_ROLES },
      { id: "substations", label: "Postes et départs", icon: PlugZap, path: "/postes", status: "ready", roles: ALL_ROLES },
    ],
  },
  {
    id: "referentiels",
    label: "Référentiels",
    items: [
      { id: "communes", label: "Communes et types", icon: MapPinned, path: "/referentiels/communes", status: "ready", roles: ADMIN_ONLY },
      { id: "equipment", label: "Matériels", icon: Wrench, path: "/referentiels/materiels", status: "ready", roles: ADMIN_ONLY },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      { id: "users", label: "Utilisateurs", icon: Users, path: "/admin/utilisateurs", status: "ready", roles: ADMIN_ONLY },
      { id: "reports", label: "Rapports et exports", icon: FileSpreadsheet, path: "/admin/rapports", status: "ready", roles: ALL_ROLES },
      { id: "settings", label: "Paramètres", icon: Settings, path: "/admin/parametres", status: "ready", roles: ALL_ROLES },
    ],
  },
]

/** Flat list of every module, in sidebar order. */
export const MODULES: ModuleItem[] = MODULE_SECTIONS.flatMap((section) => section.items)

/** Returns the sections and items a given role may see, dropping empty sections. */
export function getSectionsForRole(role: Role): ModuleSection[] {
  return MODULE_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0)
}

/** Finds the section and module matching a pathname (exact match). */
export function findModuleByPath(pathname: string): { section: ModuleSection; item: ModuleItem } | undefined {
  for (const section of MODULE_SECTIONS) {
    const item = section.items.find((candidate) => candidate.path === pathname)
    if (item) return { section, item }
  }
  return undefined
}
