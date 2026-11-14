import { MapPinned } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import {
  useCommunesAdmin,
  useCreateCommune,
  useDeleteCommune,
  useRenameCommune,
  type AdminCommune,
} from "@/data/references"
import { formatNumber } from "@/lib/format"
import {
  countLabel,
  errorMessage,
  filterByQuery,
  incidentsLabel,
  nextFormState,
  queryState,
  type FormState,
} from "@/features/references/reference-utils"

import { ReferenceFormDialog } from "./ReferenceFormDialog"
import { ReferenceList, type ReferenceColumn } from "./ReferenceList"

const NO_COMMUNES: AdminCommune[] = []
const COMMUNE_NAME_MAX = 120

const COLUMNS: ReferenceColumn<AdminCommune>[] = [
  { id: "name", header: "Commune", cell: (commune) => <span className="font-medium">{commune.name}</span> },
  { id: "incidents", header: "Incidents", numeric: true, cell: (commune) => formatNumber(commune.incidentCount) },
]

/** Communes offered on incidents. A commune used by incidents cannot be deleted, only renamed. */
export function CommunesPanel() {
  const communesQuery = useCommunesAdmin()
  const createCommune = useCreateCommune()
  const renameCommune = useRenameCommune()
  const deleteCommune = useDeleteCommune()

  const [query, setQuery] = useState("")
  const [form, setForm] = useState<FormState<AdminCommune>>({ open: false, item: null, session: 0 })
  const [pendingDelete, setPendingDelete] = useState<AdminCommune | null>(null)

  const communes = communesQuery.data ?? NO_COMMUNES
  const visible = useMemo(() => filterByQuery(communes, query, (commune) => [commune.name]), [communes, query])
  const state = queryState(communesQuery)
  const busy = createCommune.isPending || renameCommune.isPending || deleteCommune.isPending

  async function saveForm({ name }: { name: string }) {
    if (form.item) {
      await renameCommune.mutateAsync({ id: form.item.id, name })
      toast.success("Commune renommée.")
    } else {
      await createCommune.mutateAsync(name)
      toast.success("Commune ajoutée.")
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await deleteCommune.mutateAsync(pendingDelete.id)
      toast.success("Commune supprimée.")
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    }
  }

  return (
    <>
      <ReferenceList
        caption="Communes proposées sur les incidents"
        groups={[{ key: "communes", items: visible }]}
        columns={COLUMNS}
        status={state.status}
        errorDetail={state.detail}
        onRetry={() => void communesQuery.refetch()}
        query={query}
        onQueryChange={setQuery}
        searchLabel="Rechercher une commune"
        summary={countLabel(communes.length, "commune", "communes")}
        addLabel="Ajouter une commune"
        onAdd={() => setForm((previous) => nextFormState(previous, null))}
        onEdit={(commune) => setForm((previous) => nextFormState(previous, commune))}
        onDelete={setPendingDelete}
        deleteBlockedReason={(commune) =>
          commune.incidentCount > 0
            ? `Utilisée par ${incidentsLabel(commune.incidentCount)} — renommez-la plutôt`
            : null
        }
        busy={busy}
        emptyIcon={MapPinned}
        emptyTitle="Aucune commune"
        emptyDescription="Ajoutez les communes où interviennent les équipes."
      />

      <ReferenceFormDialog
        key={form.session}
        open={form.open}
        onOpenChange={(open) => setForm((previous) => ({ ...previous, open }))}
        title={form.item ? "Renommer la commune" : "Ajouter une commune"}
        submitLabel={form.item ? "Enregistrer" : "Ajouter"}
        nameLabel="Nom de la commune"
        namePlaceholder="Ex. Sidi Bernoussi"
        initialName={form.item?.name ?? ""}
        maxLength={COMMUNE_NAME_MAX}
        notice={form.item ? "Les incidents existants seront mis à jour." : undefined}
        onSubmit={saveForm}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Supprimer la commune"
        description={
          pendingDelete ? `${pendingDelete.name} sera supprimée définitivement. Cette action est irréversible.` : undefined
        }
        confirmLabel="Supprimer"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  )
}
