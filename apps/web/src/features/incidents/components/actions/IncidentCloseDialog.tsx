import { useState } from "react"

import {
  useCloseIncident,
  useIncidentMaterials,
  useMaterialCatalog,
  type MaterialLine,
} from "@/data/incidentMutations"
import type { Incident } from "@/data/incidents"
import { describeError } from "@/lib/rpc"

import { ActionDialog, ActionDialogPlaceholder } from "./ActionDialog"
import { MaterialRowsEditor, MaterialUsageChoice } from "./MaterialRowsEditor"
import {
  createMaterialRow,
  readMaterialRows,
  rowsFromLines,
  type MaterialRow,
  type MaterialUsage,
} from "./material-rows"

const TITLE = "Clôturer l'incident"

/** Clôturer: closes an open incident with its materials, or with an explicit "no material used". */
export function IncidentCloseDialog({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const materials = useIncidentMaterials(incident.id)
  const catalog = useMaterialCatalog()
  const close = (open: boolean) => {
    if (!open) onClose()
  }

  const loadError = materials.error ?? catalog.error
  if (loadError) {
    return <ActionDialogPlaceholder title={TITLE} submitLabel="Clôturer" message={describeError(loadError)} onOpenChange={close} />
  }
  if (!materials.data || !catalog.data) {
    return <ActionDialogPlaceholder title={TITLE} submitLabel="Clôturer" message="Chargement du matériel…" onOpenChange={close} />
  }

  return <IncidentCloseForm incident={incident} lines={materials.data} catalog={catalog.data} onClose={onClose} />
}

function IncidentCloseForm({
  incident,
  lines,
  catalog,
  onClose,
}: {
  incident: Incident
  lines: MaterialLine[]
  catalog: string[]
  onClose: () => void
}) {
  const close = useCloseIncident()
  const hasExisting = lines.length > 0

  // Materials already recorded are pre-filled and the choice defaults to "with materials"; a
  // "none" declaration is impossible once materials exist, so that option is disabled.
  const [usage, setUsage] = useState<MaterialUsage | null>(hasExisting ? "with" : null)
  const [rows, setRows] = useState<MaterialRow[]>(() => (hasExisting ? rowsFromLines(lines) : [createMaterialRow()]))
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (usage === null) {
      setError("Choisissez avec matériel ou aucun matériel utilisé.")
      return
    }

    const noMaterialUsed = usage === "none"
    let materials: MaterialLine[] = []
    if (!noMaterialUsed) {
      const parsed = readMaterialRows(rows, catalog)
      if (!parsed.ok) {
        setError(parsed.error)
        return
      }
      materials = parsed.materials
      if (materials.length === 0) {
        setError("Ajoutez au moins un matériel utilisé pour clôturer l'incident.")
        return
      }
    }
    setError(null)

    try {
      await close.mutateAsync({ incidentId: incident.id, materials, noMaterialUsed })
      onClose()
    } catch {
      // The mutation hook already shows the error; the dialog stays open so the admin can retry.
    }
  }

  return (
    <ActionDialog
      title={TITLE}
      description="Indiquez le matériel utilisé avant de clôturer l'incident."
      submitLabel="Clôturer l'incident"
      pending={close.isPending}
      error={error}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      onSubmit={() => void submit()}
    >
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-none font-medium">Matériel utilisé</span>
        <MaterialUsageChoice
          value={usage}
          onChange={setUsage}
          disabled={close.isPending}
          noneDisabled={hasExisting}
        />
        {hasExisting ? (
          <p className="text-xs text-muted-foreground">
            Du matériel est déjà saisi pour cet incident, il ne peut donc pas être déclaré « aucun ».
          </p>
        ) : null}
      </div>

      {usage === "none" ? (
        <p className="rounded-xl bg-muted/50 px-3.5 py-3 text-sm text-muted-foreground">
          L'incident sera clôturé sans matériel.
        </p>
      ) : usage === "with" ? (
        <MaterialRowsEditor rows={rows} catalog={catalog} onChange={setRows} disabled={close.isPending} />
      ) : null}
    </ActionDialog>
  )
}
