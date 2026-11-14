import { CircleCheck, Package, Pencil, RotateCcw, Trash2 } from "lucide-react"
import { useState } from "react"

import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
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
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setActive("edit")}>
          <Pencil aria-hidden="true" />
          Modifier
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setActive("materials")}>
          <Package aria-hidden="true" />
          Matériel
        </Button>
        {isOpen ? (
          <Button size="sm" onClick={() => setActive("close")}>
            <CircleCheck aria-hidden="true" />
            Clôturer
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setActive("reopen")}>
            <RotateCcw aria-hidden="true" />
            Rouvrir
          </Button>
        )}
        <Button variant="destructive" size="sm" onClick={() => setActive("archive")}>
          <Trash2 aria-hidden="true" />
          Supprimer
        </Button>
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
