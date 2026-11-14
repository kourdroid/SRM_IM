import { useState } from "react"

import {
  useIncidentMaterials,
  useMaterialCatalog,
  useUpdateIncidentMaterials,
  type MaterialLine,
} from "@/data/incidentMutations"
import type { Incident } from "@/data/incidents"
import { describeError } from "@/lib/rpc"

import { ActionDialog, ActionDialogPlaceholder } from "./ActionDialog"
import { MaterialRowsEditor, MaterialUsageChoice } from "./MaterialRowsEditor"
import { readMaterialRows, rowsFromLines, sameMaterials, type MaterialRow, type MaterialUsage } from "./material-rows"

const TITLE = "Matériel utilisé"

/** Matériel: edits the material list of an incident. Closed incidents can also be declared "none". */
export function IncidentMaterialsDialog({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const materials = useIncidentMaterials(incident.id)
  const catalog = useMaterialCatalog()
  const close = (open: boolean) => {
    if (!open) onClose()
  }

  const loadError = materials.error ?? catalog.error
  if (loadError) {
    return <ActionDialogPlaceholder title={TITLE} submitLabel="Enregistrer" message={describeError(loadError)} onOpenChange={close} />
  }
  if (!materials.data || !catalog.data) {
    return <ActionDialogPlaceholder title={TITLE} submitLabel="Enregistrer" message="Chargement du matériel…" onOpenChange={close} />
  }

  return (
    <IncidentMaterialsForm incident={incident} lines={materials.data} catalog={catalog.data} onClose={onClose} />
  )
}

function IncidentMaterialsForm({
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
  const update = useUpdateIncidentMaterials()
  const isClosed = incident.status === "closed"

  const [usage, setUsage] = useState<MaterialUsage>(incident.noMaterialUsed ? "none" : "with")
  const [rows, setRows] = useState<MaterialRow[]>(() => rowsFromLines(lines))
  const [error, setError] = useState<string | null>(null)

  // Open incidents always carry a material list (possibly empty); only closed ones can say "none".
  const noMaterialUsed = isClosed && usage === "none"

  const submit = async () => {
    let materials: MaterialLine[] = []
    if (!noMaterialUsed) {
      const parsed = readMaterialRows(rows, catalog)
      if (!parsed.ok) {
        setError(parsed.error)
        return
      }
      materials = parsed.materials
    }

    if (isClosed && !noMaterialUsed && materials.length === 0) {
      setError("Ajoutez au moins un matériel utilisé, ou choisissez « Aucun matériel utilisé ».")
      return
    }
    setError(null)

    const unchanged = noMaterialUsed === incident.noMaterialUsed && sameMaterials(materials, lines)
    if (unchanged) {
      onClose()
      return
    }

    try {
      await update.mutateAsync({ incidentId: incident.id, materials, noMaterialUsed })
      onClose()
    } catch {
      // The mutation hook already shows the error; the dialog stays open so the admin can retry.
    }
  }

  return (
    <ActionDialog
      title={TITLE}
      description="Ajoutez, modifiez ou retirez le matériel utilisé pour cet incident."
      submitLabel="Enregistrer"
      pending={update.isPending}
      error={error}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      onSubmit={() => void submit()}
    >
      {isClosed ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm leading-none font-medium">Matériel utilisé</span>
          <MaterialUsageChoice value={usage} onChange={setUsage} disabled={update.isPending} />
        </div>
      ) : null}

      {noMaterialUsed ? (
        <p className="rounded-xl bg-muted/50 px-3.5 py-3 text-sm text-muted-foreground">
          Aucun matériel ne sera enregistré pour cet incident.
        </p>
      ) : (
        <MaterialRowsEditor rows={rows} catalog={catalog} onChange={setRows} disabled={update.isPending} />
      )}
    </ActionDialog>
  )
}
