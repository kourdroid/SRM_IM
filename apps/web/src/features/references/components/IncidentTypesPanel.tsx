import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { NetworkBadge } from "@/components/shared/NetworkBadge"
import { SegmentedControl, type SegmentedOption } from "@/components/shared/SegmentedControl"
import {
  useCreateIncidentType,
  useDeleteIncidentType,
  useIncidentTypeOptions,
  useSaveIncidentType,
  useSaveIncidentTypeOrder,
  type IncidentTypeOption,
  type NetworkType,
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
import { ReferenceList, type ReferenceColumn, type ReferenceGroup } from "./ReferenceList"

type NetworkFilter = NetworkType | "all"

const NO_TYPES: IncidentTypeOption[] = []
const NETWORKS: NetworkType[] = ["BT", "MT"]
const NETWORK_GROUP_LABEL: Record<NetworkType, string> = {
  BT: "Basse tension (BT)",
  MT: "Moyenne tension (MT)",
}
const NETWORK_FILTERS: SegmentedOption<NetworkFilter>[] = [
  { value: "all", label: "Tous", ariaLabel: "Tous les réseaux" },
  { value: "BT", label: "BT", ariaLabel: "Basse tension (BT)" },
  { value: "MT", label: "MT", ariaLabel: "Moyenne tension (MT)" },
]
const TYPE_NAME_MAX = 160

const COLUMNS: ReferenceColumn<IncidentTypeOption>[] = [
  { id: "network", header: "Réseau", cell: (type) => <NetworkBadge network={type.networkType} /> },
  { id: "name", header: "Type d'incident", cell: (type) => <span className="font-medium">{type.name}</span> },
  {
    id: "incidents",
    header: "Incidents",
    className: "text-right",
    cell: (type) => <span className="tabular-nums">{formatNumber(type.incidentCount)}</span>,
  },
]

/**
 * Incident types per network. Ordering is per network: the up and down buttons only move a type among the
 * types of its own network. The network of a type used by incidents is locked, and a used type cannot be
 * deleted, only deactivated.
 */
export function IncidentTypesPanel() {
  const typesQuery = useIncidentTypeOptions()
  const createType = useCreateIncidentType()
  const saveType = useSaveIncidentType()
  const saveOrder = useSaveIncidentTypeOrder()
  const deleteType = useDeleteIncidentType()

  const [query, setQuery] = useState("")
  const [network, setNetwork] = useState<NetworkFilter>("all")
  const [form, setForm] = useState<FormState<IncidentTypeOption>>({ open: false, item: null, session: 0 })
  const [pendingDelete, setPendingDelete] = useState<IncidentTypeOption | null>(null)

  const types = typesQuery.data ?? NO_TYPES
  const visible = useMemo(
    () =>
      filterByQuery(
        types.filter((type) => network === "all" || type.networkType === network),
        query,
        (type) => [type.name],
      ),
    [types, network, query],
  )
  const groups = useMemo<ReferenceGroup<IncidentTypeOption>[]>(
    () =>
      NETWORKS.map((networkType) => ({
        key: networkType,
        label: network === "all" ? NETWORK_GROUP_LABEL[networkType] : undefined,
        items: visible.filter((type) => type.networkType === networkType),
      })),
    [visible, network],
  )

  const state = queryState(typesQuery)
  const busy = createType.isPending || saveType.isPending || saveOrder.isPending || deleteType.isPending

  function moveType(item: IncidentTypeOption, direction: Direction) {
    const siblings = types.filter((type) => type.networkType === item.networkType)
    const changes = reorderChanges(siblings, item.id, direction)
    if (changes.length === 0) return
    saveOrder.mutate(changes, {
      onSuccess: () => toast.success("Ordre enregistré."),
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  function toggleType(item: IncidentTypeOption) {
    saveType.mutate(
      { id: item.id, networkType: item.networkType, name: item.name, active: !item.active, sortOrder: item.sortOrder },
      {
        onSuccess: () => toast.success(item.active ? "Type d'incident désactivé." : "Type d'incident activé."),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  async function saveForm({ name, networkType }: { name: string; networkType?: NetworkType }) {
    if (!networkType) throw new Error("Choisissez un réseau.")

    const editing = form.item
    if (editing) {
      await saveType.mutateAsync({
        id: editing.id,
        networkType,
        name,
        active: editing.active,
        sortOrder: editing.sortOrder,
      })
      toast.success("Type d'incident mis à jour.")
    } else {
      await createType.mutateAsync({ networkType, name })
      toast.success("Type d'incident ajouté.")
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await deleteType.mutateAsync(pendingDelete.id)
      toast.success("Type d'incident supprimé.")
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    }
  }

  const editingLocked = form.item !== null && form.item.incidentCount > 0

  return (
    <>
      <ReferenceList
        caption="Types d'incidents par réseau"
        groups={groups}
        columns={COLUMNS}
        status={state.status}
        errorDetail={state.detail}
        onRetry={() => void typesQuery.refetch()}
        query={query}
        onQueryChange={setQuery}
        searchLabel="Rechercher un type d'incident"
        filters={
          <SegmentedControl<NetworkFilter>
            value={network}
            onValueChange={setNetwork}
            options={NETWORK_FILTERS}
            ariaLabel="Filtrer par réseau"
            className="bg-card shadow-soft"
          />
        }
        addLabel="Ajouter un type"
        onAdd={() => setForm((previous) => nextFormState(previous, null))}
        isActive={(type) => type.active}
        onToggleActive={toggleType}
        onMove={moveType}
        reorderLocked={query.trim() !== ""}
        onEdit={(type) => setForm((previous) => nextFormState(previous, type))}
        onDelete={setPendingDelete}
        deleteBlockedReason={(type) =>
          type.incidentCount > 0 ? `Utilisé par ${incidentsLabel(type.incidentCount)}. Désactivez-le plutôt.` : null
        }
        busy={busy}
        emptyTitle="Aucun type d'incident"
        emptyDescription="Ajoutez les types BT et MT proposés aux agents."
      />

      <ReferenceFormDialog
        key={form.session}
        open={form.open}
        onOpenChange={(open) => setForm((previous) => ({ ...previous, open }))}
        title={form.item ? "Modifier le type d'incident" : "Ajouter un type d'incident"}
        submitLabel={form.item ? "Enregistrer" : "Ajouter"}
        nameLabel="Nom du type"
        namePlaceholder="Ex. Manque phase"
        initialName={form.item?.name ?? ""}
        maxLength={TYPE_NAME_MAX}
        network={{
          initial: form.item?.networkType ?? (network === "MT" ? "MT" : "BT"),
          lockedReason: editingLocked
            ? `Réseau verrouillé : ce type est utilisé par ${incidentsLabel(form.item?.incidentCount ?? 0)}.`
            : undefined,
        }}
        notice={form.item ? "Les incidents existants seront mis à jour." : undefined}
        onSubmit={saveForm}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Supprimer le type d'incident"
        description={
          pendingDelete
            ? `${pendingDelete.name} (${pendingDelete.networkType}) sera supprimé définitivement. Cette action est irréversible.`
            : undefined
        }
        confirmLabel="Supprimer"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  )
}
