import { CircleCheck, Ellipsis, Package, Pencil, RotateCcw, Trash2 } from "lucide-react"
import { useState } from "react"

import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useIsAdmin } from "@/features/auth/useIsAdmin"
import { useArchiveIncident, useReopenIncident } from "@/data/incidentMutations"
import type { Incident } from "@/data/incidents"

import { IncidentCloseDialog } from "./IncidentCloseDialog"
import { IncidentEditDialog } from "./IncidentEditDialog"
import { IncidentMaterialsDialog } from "./IncidentMaterialsDialog"

type ActiveDialog = "edit" | "materials" | "close" | "reopen" | "archive"

/**
 * Admin actions for one incident, shown at the top of the detail sheet. Directors get nothing rendered.
 * Each dialog is mounted only while open, so its form starts from the incident's current values.
 */
export function IncidentAdminActions({ incident, onArchived }: { incident: Incident; onArchived: () => void }) {
  const isAdmin = useIsAdmin()
  const [active, setActive] = useState<ActiveDialog | null>(null)
  const reopen = useReopenIncident()
  const archive = useArchiveIncident()

  if (!isAdmin) return null

  const isOpen = incident.status === "open"
  const closeDialog = () => setActive(null)

  return (
    <>
      <div className="flex flex-col gap-2">
        {isOpen ? (
          <Button size="lg" className="w-full" onClick={() => setActive("close")}>
            <CircleCheck aria-hidden="true" />
            Clôturer l'incident
          </Button>
        ) : null}
        <div className="flex gap-2">
          {isOpen ? null : (
            <Button variant="secondary" className="flex-1" onClick={() => setActive("reopen")}>
              <RotateCcw aria-hidden="true" />
              Rouvrir
            </Button>
          )}
          <Button variant="secondary" className="flex-1" onClick={() => setActive("edit")}>
            <Pencil aria-hidden="true" />
            Modifier
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setActive("materials")}>
            <Package aria-hidden="true" />
            Matériel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="default" aria-label="Plus d'actions sur l'incident">
                <Ellipsis aria-hidden="true" />
                Plus
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52 rounded-xl shadow-soft-lg">
              <DropdownMenuItem variant="destructive" onSelect={() => setActive("archive")}>
                <Trash2 aria-hidden="true" />
                Supprimer l'incident
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {active === "edit" ? <IncidentEditDialog incident={incident} onClose={closeDialog} /> : null}
      {active === "materials" ? <IncidentMaterialsDialog incident={incident} onClose={closeDialog} /> : null}
      {active === "close" ? <IncidentCloseDialog incident={incident} onClose={closeDialog} /> : null}

      <ConfirmDialog
        open={active === "reopen"}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        title="Rouvrir l'incident ?"
        description="L'incident repassera en cours. Le matériel déjà saisi reste enregistré."
        confirmLabel="Rouvrir"
        onConfirm={() => reopen.mutateAsync(incident.id)}
      />

      <ConfirmDialog
        open={active === "archive"}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        title="Supprimer cet incident ?"
        description="L'incident sera retiré des listes, des statistiques et des rapports. Son historique reste conservé."
        confirmLabel="Supprimer"
        destructive
        onConfirm={async () => {
          await archive.mutateAsync(incident.id)
          onArchived()
        }}
      />
    </>
  )
}
