import { Wrench } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import {
  useCreateMaterial,
  useDeleteMaterial,
  useMaterialOptions,
  useSaveMaterial,
  useSaveMaterialOrder,
  type MaterialOption,
} from "@/data/references"
import { formatNumber } from "@/lib/format"
import {
  errorMessage,
  filterByQuery,
  nextFormState,
  queryState,
  reorderChanges,
  savedLabel,
  type Direction,
  type FormState,
} from "@/features/references/reference-utils"

import { ReferenceFormDialog } from "./ReferenceFormDialog"
import { ReferenceList, type ReferenceColumn } from "./ReferenceList"

const NO_MATERIALS: MaterialOption[] = []
const MATERIAL_NAME_MAX = 160

const COLUMNS: ReferenceColumn<MaterialOption>[] = [
  { id: "name", header: "Matériel", cell: (material) => <span className="font-medium">{material.name}</span> },
  {
    id: "usage",
    header: "Saisies",
    className: "text-right",
    cell: (material) => <span className="tabular-nums">{formatNumber(material.usageCount)}</span>,
  },
]

/** Material catalogue offered when closing an incident. A material already used on incidents cannot be deleted. */
export function MaterialsPanel() {
  const materialsQuery = useMaterialOptions()
  const createMaterial = useCreateMaterial()
  const saveMaterial = useSaveMaterial()
  const saveOrder = useSaveMaterialOrder()
  const deleteMaterial = useDeleteMaterial()

  const [query, setQuery] = useState("")
  const [form, setForm] = useState<FormState<MaterialOption>>({ open: false, item: null, session: 0 })
  const [pendingDelete, setPendingDelete] = useState<MaterialOption | null>(null)

  const materials = materialsQuery.data ?? NO_MATERIALS
  const visible = useMemo(() => filterByQuery(materials, query, (material) => [material.name]), [materials, query])
  const groups = useMemo(() => [{ key: "materials", items: visible }], [visible])
  const state = queryState(materialsQuery)
  const busy = createMaterial.isPending || saveMaterial.isPending || saveOrder.isPending || deleteMaterial.isPending

  function moveMaterial(item: MaterialOption, direction: Direction) {
    const changes = reorderChanges(materials, item.id, direction)
    if (changes.length === 0) return
    saveOrder.mutate(changes, {
      onSuccess: () => toast.success("Ordre enregistré."),
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  function toggleMaterial(item: MaterialOption) {
    saveMaterial.mutate(
      { id: item.id, name: item.name, active: !item.active, sortOrder: item.sortOrder },
      {
        onSuccess: () => toast.success(item.active ? "Matériel désactivé." : "Matériel activé."),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  async function saveForm({ name }: { name: string }) {
    const editing = form.item
    if (editing) {
      await saveMaterial.mutateAsync({ id: editing.id, name, active: editing.active, sortOrder: editing.sortOrder })
      toast.success("Matériel mis à jour.")
    } else {
      await createMaterial.mutateAsync(name)
      toast.success("Matériel ajouté.")
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await deleteMaterial.mutateAsync(pendingDelete.id)
      toast.success("Matériel supprimé.")
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    }
  }

  return (
    <>
      <ReferenceList
        caption="Catalogue des matériels"
        groups={groups}
        columns={COLUMNS}
        status={state.status}
        errorDetail={state.detail}
        onRetry={() => void materialsQuery.refetch()}
        query={query}
        onQueryChange={setQuery}
        searchLabel="Rechercher un matériel"
        addLabel="Ajouter un matériel"
        onAdd={() => setForm((previous) => nextFormState(previous, null))}
        isActive={(material) => material.active}
        onToggleActive={toggleMaterial}
        onMove={moveMaterial}
        reorderLocked={query.trim() !== ""}
        onEdit={(material) => setForm((previous) => nextFormState(previous, material))}
        onDelete={setPendingDelete}
        deleteBlockedReason={(material) =>
          material.usageCount > 0 ? `Utilisé dans ${savedLabel(material.usageCount)}. Désactivez-le plutôt.` : null
        }
        busy={busy}
        emptyIcon={Wrench}
        emptyTitle="Aucun matériel"
        emptyDescription="Ajoutez les matériels utilisés par les équipes."
      />

      <ReferenceFormDialog
        key={form.session}
        open={form.open}
        onOpenChange={(open) => setForm((previous) => ({ ...previous, open }))}
        title={form.item ? "Renommer le matériel" : "Ajouter un matériel"}
        submitLabel={form.item ? "Enregistrer" : "Ajouter"}
        nameLabel="Nom du matériel"
        namePlaceholder="Ex. Connecteur"
        initialName={form.item?.name ?? ""}
        maxLength={MATERIAL_NAME_MAX}
        notice={form.item ? "Les incidents existants seront mis à jour." : undefined}
        onSubmit={saveForm}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Supprimer le matériel"
        description={
          pendingDelete
            ? `${pendingDelete.name} sera supprimé définitivement. Cette action est irréversible.`
            : undefined
        }
        confirmLabel="Supprimer"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  )
}
