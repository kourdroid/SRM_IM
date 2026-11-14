import { Zap } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  useCreateDepartHta,
  useDepartsHtaOptions,
  useSaveDepartHta,
  useSaveDepartHtaOrder,
  type DepartHtaOption,
} from "@/data/references"
import { formatNumber } from "@/lib/format"
import {
  errorMessage,
  filterByQuery,
  incidentsLabel,
  nextFormState,
  queryState,
  reorderChanges,
  type Direction,
  type FormState,
} from "@/features/references/reference-utils"

import { ReferenceFormDialog } from "./ReferenceFormDialog"
import { ReferenceList, type ReferenceColumn } from "./ReferenceList"

const NO_DEPARTS: DepartHtaOption[] = []
const DEPART_NAME_MAX = 160

const COLUMNS: ReferenceColumn<DepartHtaOption>[] = [
  { id: "name", header: "Départ HTA", cell: (depart) => <span className="font-medium">{depart.name}</span> },
  {
    id: "incidents",
    header: "Incidents",
    className: "text-right",
    cell: (depart) => <span className="tabular-nums">{formatNumber(depart.incidentCount)}</span>,
  },
]

/**
 * Départs HTA offered on MT incidents. There is no delete: a depart is deactivated instead. A depart used by
 * incidents keeps its name, because incidents store the name as typed.
 */
export function DepartsHtaPanel() {
  const departsQuery = useDepartsHtaOptions()
  const createDepart = useCreateDepartHta()
  const saveDepart = useSaveDepartHta()
  const saveOrder = useSaveDepartHtaOrder()

  const [query, setQuery] = useState("")
  const [form, setForm] = useState<FormState<DepartHtaOption>>({ open: false, item: null, session: 0 })

  const departs = departsQuery.data ?? NO_DEPARTS
  const visible = useMemo(() => filterByQuery(departs, query, (depart) => [depart.name]), [departs, query])
  const groups = useMemo(() => [{ key: "departs", items: visible }], [visible])
  const state = queryState(departsQuery)
  const busy = createDepart.isPending || saveDepart.isPending || saveOrder.isPending

  function moveDepart(item: DepartHtaOption, direction: Direction) {
    const changes = reorderChanges(departs, item.id, direction)
    if (changes.length === 0) return
    saveOrder.mutate(changes, {
      onSuccess: () => toast.success("Ordre enregistré."),
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  function toggleDepart(item: DepartHtaOption) {
    saveDepart.mutate(
      { id: item.id, name: item.name, active: !item.active, sortOrder: item.sortOrder },
      {
        onSuccess: () => toast.success(item.active ? "Départ HTA désactivé." : "Départ HTA activé."),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  async function saveForm({ name }: { name: string }) {
    const editing = form.item
    if (editing) {
      await saveDepart.mutateAsync({ id: editing.id, name, active: editing.active, sortOrder: editing.sortOrder })
      toast.success("Départ HTA mis à jour.")
    } else {
      await createDepart.mutateAsync(name)
      toast.success("Départ HTA ajouté.")
    }
  }

  const nameLocked = form.item !== null && form.item.incidentCount > 0

  return (
    <>
      <ReferenceList
        caption="Départs HTA proposés sur les incidents MT"
        groups={groups}
        columns={COLUMNS}
        status={state.status}
        errorDetail={state.detail}
        onRetry={() => void departsQuery.refetch()}
        query={query}
        onQueryChange={setQuery}
        searchLabel="Rechercher un départ HTA"
        addLabel="Ajouter un départ"
        onAdd={() => setForm((previous) => nextFormState(previous, null))}
        isActive={(depart) => depart.active}
        onToggleActive={toggleDepart}
        onMove={moveDepart}
        reorderLocked={query.trim() !== ""}
        onEdit={(depart) => setForm((previous) => nextFormState(previous, depart))}
        busy={busy}
        emptyIcon={Zap}
        emptyTitle="Aucun Départ HTA"
        emptyDescription="Ajoutez les départs HTA utilisés dans les incidents MT."
      />

      <ReferenceFormDialog
        key={form.session}
        open={form.open}
        onOpenChange={(open) => setForm((previous) => ({ ...previous, open }))}
        title={form.item ? "Renommer le départ HTA" : "Ajouter un départ HTA"}
        submitLabel={form.item ? "Enregistrer" : "Ajouter"}
        nameLabel="Nom du départ"
        namePlaceholder="Ex. Départ 1"
        initialName={form.item?.name ?? ""}
        maxLength={DEPART_NAME_MAX}
        nameLockedReason={
          nameLocked && form.item
            ? `Nom verrouillé : ce départ est utilisé par ${incidentsLabel(form.item.incidentCount)}. Vous pouvez changer son ordre ou son état.`
            : undefined
        }
        onSubmit={saveForm}
      />
    </>
  )
}
