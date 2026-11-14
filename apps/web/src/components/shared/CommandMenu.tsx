import {
  CircleCheck,
  CircleDot,
  FileSpreadsheet,
  LogOut,
  Map as MapIcon,
  Moon,
  Sun,
  TriangleExclamationPoint,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { getSectionsForRole } from "@/app/modules"
import { CommandFooter } from "@/components/shared/command/CommandFooter"
import { CommandRow } from "@/components/shared/command/CommandRow"
import { CommuneResults } from "@/components/shared/command/CommuneResults"
import { IncidentResults } from "@/components/shared/command/IncidentResults"
import { UserResults } from "@/components/shared/command/UserResults"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useCommunes, type Commune } from "@/data/incidents"
import { INCIDENT_SEARCH_MIN_LENGTH, matchCommunes, useIncidentSearch, type IncidentSearchHit } from "@/data/search"
import type { ManagedUser } from "@/data/users"
import { useAuth } from "@/features/auth/auth-context"
import { useCurrentUser } from "@/features/auth/useCurrentUser"
import { useIsAdmin } from "@/features/auth/useIsAdmin"
import { useDebouncedValue } from "@/features/incidents/useDebouncedValue"
import { normalizeSearchText } from "@/lib/text"

import { useTheme } from "./theme-context"

type CommandMenuProps = { open: boolean; onOpenChange: (open: boolean) => void }

/** A static palette entry (shortcut, action or module), filtered by its label and keywords. */
type StaticItem = {
  value: string
  label: string
  keywords: string
  description?: string
  icon: LucideIcon
  onSelect: () => void
}

/** Command palette (Ctrl/Cmd+K): incidents, communes, users, shortcuts, actions and modules. */
export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Recherche"
      description="Rechercher un incident, une commune ou un utilisateur, ou accéder à un module"
    >
      <CommandPalette onOpenChange={onOpenChange} />
    </CommandDialog>
  )
}

/** True when the static item's label or keywords contain the normalized query. */
function matchesNeedle(item: StaticItem, needle: string): boolean {
  if (needle === "") return true
  return normalizeSearchText(`${item.label} ${item.keywords}`).includes(needle)
}

function StaticGroup({ heading, items }: { heading: string; items: StaticItem[] }) {
  if (items.length === 0) return null
  return (
    <CommandGroup heading={heading}>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <CommandItem key={item.value} value={item.value} onSelect={item.onSelect}>
            <CommandRow leading={<Icon aria-hidden="true" />} title={item.label} description={item.description} />
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}

/** Stateful palette; mounted only while the dialog is open, so the query resets on close. */
function CommandPalette({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const user = useCurrentUser()
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const [query, setQuery] = useState("")

  const trimmed = query.trim()
  const needle = normalizeSearchText(query)
  const hasQuery = needle !== ""

  const debounced = useDebouncedValue(query, 200)
  const incidentTerm = debounced.trim()
  const incidentActive = incidentTerm.length >= INCIDENT_SEARCH_MIN_LENGTH
  const incidents = useIncidentSearch(incidentTerm, true)

  const communes = useCommunes()
  const communeMatches = hasQuery ? matchCommunes(communes.data ?? [], query, 5) : []

  function runAndClose(action: () => void) {
    onOpenChange(false)
    action()
  }

  function selectIncident(hit: IncidentSearchHit) {
    runAndClose(() => navigate(`/incidents?incident=${encodeURIComponent(hit.id)}&periode=all`))
  }

  function selectCommune(commune: Commune) {
    runAndClose(() => navigate(`/incidents?commune=${encodeURIComponent(commune.id)}`))
  }

  function selectUser(selected: ManagedUser) {
    runAndClose(() =>
      navigate(`/admin/utilisateurs?recherche=${encodeURIComponent(selected.name?.trim() || selected.email || "")}`),
    )
  }

  const shortcuts: StaticItem[] = [
    {
      value: "shortcut:incidents-open",
      label: "Incidents en cours",
      keywords: "ouvert ouverts actif actifs",
      icon: CircleDot,
      onSelect: () => runAndClose(() => navigate("/incidents?statut=open")),
    },
    {
      value: "shortcut:incidents-closed",
      label: "Incidents clôturés",
      keywords: "fermé fermés terminé terminés",
      icon: CircleCheck,
      onSelect: () => runAndClose(() => navigate("/incidents?statut=closed")),
    },
    {
      value: "shortcut:incidents-mt",
      label: "Incidents MT",
      keywords: "moyenne tension réseau",
      icon: TriangleExclamationPoint,
      onSelect: () => runAndClose(() => navigate("/incidents?reseau=MT")),
    },
    {
      value: "shortcut:incidents-bt",
      label: "Incidents BT",
      keywords: "basse tension réseau",
      icon: TriangleExclamationPoint,
      onSelect: () => runAndClose(() => navigate("/incidents?reseau=BT")),
    },
    {
      value: "shortcut:map",
      label: "Carte des incidents",
      keywords: "carte plan localisation",
      icon: MapIcon,
      onSelect: () => runAndClose(() => navigate("/carte")),
    },
  ]

  const ThemeIcon = resolvedTheme === "dark" ? Sun : Moon

  const actions: StaticItem[] = [
    ...(isAdmin
      ? [
          {
            value: "action:new-user",
            label: "Nouvel utilisateur",
            keywords: "créer ajouter compte",
            icon: UserPlus,
            onSelect: () => runAndClose(() => navigate("/admin/utilisateurs?nouveau=1")),
          },
        ]
      : []),
    {
      value: "action:export-incidents",
      label: "Exporter les incidents en Excel",
      keywords: "export excel rapport rapports télécharger",
      icon: FileSpreadsheet,
      onSelect: () => runAndClose(() => navigate("/admin/rapports")),
    },
    {
      value: "action:toggle-theme",
      label: "Changer de thème",
      keywords: "thème sombre clair mode couleur",
      icon: ThemeIcon,
      onSelect: () => runAndClose(() => setTheme(resolvedTheme === "dark" ? "light" : "dark")),
    },
    {
      value: "action:sign-out",
      label: "Se déconnecter",
      keywords: "déconnexion quitter sortir",
      icon: LogOut,
      onSelect: () => runAndClose(() => void signOut()),
    },
  ]

  const modules: StaticItem[] = getSectionsForRole(user.role).flatMap((section) =>
    section.items
      .filter((item) => item.status === "ready")
      .map((item) => ({
        value: `module:${item.id}`,
        label: item.label,
        keywords: section.label,
        description: section.label,
        icon: item.icon,
        onSelect: () => runAndClose(() => navigate(item.path)),
      })),
  )

  const visibleShortcuts = shortcuts.filter((item) => matchesNeedle(item, needle))
  const visibleActions = actions.filter((item) => matchesNeedle(item, needle))
  const visibleModules = modules.filter((item) => matchesNeedle(item, needle))

  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={isAdmin ? "Rechercher un incident, une commune, un utilisateur…" : "Rechercher un incident, une commune…"}
        aria-label="Rechercher"
      />
      <CommandList className="max-h-[min(60vh,28rem)]">
        {/* Communes match instantly and take the first selection; incidents arrive from the server a moment later,
            so they come second: what Enter opens is always the row shown on top. */}
        {communeMatches.length > 0 ? <CommuneResults communes={communeMatches} onSelect={selectCommune} /> : null}
        {hasQuery ? (
          <IncidentResults
            active={incidentActive}
            isFetching={incidents.isFetching}
            hits={incidents.data}
            onSelect={selectIncident}
          />
        ) : null}
        {isAdmin && hasQuery ? <UserResults query={query} onSelect={selectUser} /> : null}
        <StaticGroup heading="Raccourcis" items={visibleShortcuts} />
        <StaticGroup heading="Actions" items={visibleActions} />
        <StaticGroup heading="Modules" items={visibleModules} />
        {hasQuery && !incidents.isFetching ? <CommandEmpty>Aucun résultat pour « {trimmed} »</CommandEmpty> : null}
      </CommandList>
      <CommandFooter />
    </Command>
  )
}
