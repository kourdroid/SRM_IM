import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query"

import { cleanLabel } from "@/data/incidents"
import { throwIfError } from "@/lib/rpc"
import { supabase } from "@/lib/supabase"

/**
 * Reference lists administered from the dashboard: communes, incident types (BT/MT), Départs HTA and the
 * material catalogue. Reads and writes go through the admin RPCs. Renames are applied server-side to
 * existing incidents, so the incident queries are refreshed after each change.
 */

export type NetworkType = "BT" | "MT"

export type AdminCommune = {
  id: string
  name: string
  incidentCount: number
}

export type IncidentTypeOption = {
  id: string
  networkType: NetworkType
  name: string
  active: boolean
  sortOrder: number
  incidentCount: number
}

export type DepartHtaOption = {
  id: string
  name: string
  active: boolean
  sortOrder: number
  incidentCount: number
}

export type MaterialOption = {
  id: string
  name: string
  active: boolean
  sortOrder: number
  usageCount: number
}

export type MaterialUsage = {
  materialName: string
  uses: number
}

export type IncidentTypeInput = Pick<IncidentTypeOption, "id" | "networkType" | "name" | "active" | "sortOrder">
export type DepartHtaInput = Pick<DepartHtaOption, "id" | "name" | "active" | "sortOrder">
export type MaterialInput = Pick<MaterialOption, "id" | "name" | "active" | "sortOrder">

/** Every reference query key starts with "references", so the lists can be refreshed together. */
export const REFERENCE_KEYS = {
  communes: ["references", "communes"],
  incidentTypes: ["references", "incident-types"],
  departsHta: ["references", "departs-hta"],
  materials: ["references", "materials"],
  materialUsage: ["references", "material-usage"],
} as const

/** Incident pages show commune, type and Départ HTA names, so their queries are refreshed after changes. */
const COMMUNE_INVALIDATIONS: QueryKey[] = [REFERENCE_KEYS.communes, ["communes"], ["incidents"]]
const INCIDENT_TYPE_INVALIDATIONS: QueryKey[] = [REFERENCE_KEYS.incidentTypes, ["incidents"]]
const DEPART_HTA_INVALIDATIONS: QueryKey[] = [REFERENCE_KEYS.departsHta, ["incidents"]]
const MATERIAL_INVALIDATIONS: QueryKey[] = [REFERENCE_KEYS.materials, REFERENCE_KEYS.materialUsage]

type CountValue = number | string | null

type CommuneRow = { id: string; name: string | null; incident_count: CountValue }
type IncidentTypeRow = {
  id: string
  network_type: NetworkType
  name: string | null
  active: boolean | null
  sort_order: CountValue
  incident_count: CountValue
}
type DepartHtaRow = {
  id: string
  name: string | null
  active: boolean | null
  sort_order: CountValue
  incident_count: CountValue
}
type MaterialRow = {
  id: string
  name: string | null
  active: boolean | null
  sort_order: CountValue
  usage_count: CountValue
}
type MaterialUsageRow = { material_name: string | null; uses: CountValue }

/** RPC counts arrive as numbers or strings depending on the column type. */
function toNumber(value: CountValue | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Display order for catalogues: sort order first, then name in French collation. */
function compareOrder(a: { sortOrder: number; name: string }, b: { sortOrder: number; name: string }): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr")
}

/** Incident types are grouped by network (BT, then MT), then sorted like every catalogue. */
function compareIncidentTypes(a: IncidentTypeOption, b: IncidentTypeOption): number {
  return a.networkType.localeCompare(b.networkType) || compareOrder(a, b)
}

/** Applies saved fields to the cached rows with the same ids, then sorts them for display. */
function mergeRows<TRow extends { id: string }>(
  rows: readonly TRow[],
  changes: readonly ({ id: string } & Partial<TRow>)[],
  sort: (a: TRow, b: TRow) => number,
): TRow[] {
  const changesById = new Map(changes.map((change) => [change.id, change]))
  return rows
    .map((row): TRow => {
      const change = changesById.get(row.id)
      return change ? { ...row, ...change } : row
    })
    .sort(sort)
}

async function listRows<T>(fn: string, fallback: string): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn)
  throwIfError(error, fallback)
  return (data ?? []) as T[]
}

async function writeRpc(fn: string, args: Record<string, unknown>, fallback: string): Promise<void> {
  const { error } = await supabase.rpc(fn, args)
  throwIfError(error, fallback)
}

export async function fetchCommunes(): Promise<AdminCommune[]> {
  const rows = await listRows<CommuneRow>("get_admin_communes", "Chargement des communes impossible.")
  return rows
    .map((row) => ({ id: row.id, name: cleanLabel(row.name), incidentCount: toNumber(row.incident_count) }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
}

export async function fetchIncidentTypes(): Promise<IncidentTypeOption[]> {
  const rows = await listRows<IncidentTypeRow>(
    "get_admin_incident_type_options",
    "Chargement des types d'incidents impossible.",
  )
  return rows
    .map((row) => ({
      id: row.id,
      networkType: row.network_type,
      name: cleanLabel(row.name),
      active: row.active === true,
      sortOrder: toNumber(row.sort_order),
      incidentCount: toNumber(row.incident_count),
    }))
    .sort(compareIncidentTypes)
}

export async function fetchDepartsHta(): Promise<DepartHtaOption[]> {
  const rows = await listRows<DepartHtaRow>("get_admin_depart_hta_options", "Chargement des Départs HTA impossible.")
  return rows
    .map((row) => ({
      id: row.id,
      name: cleanLabel(row.name),
      active: row.active === true,
      sortOrder: toNumber(row.sort_order),
      incidentCount: toNumber(row.incident_count),
    }))
    .sort(compareOrder)
}

export async function fetchMaterialOptions(): Promise<MaterialOption[]> {
  const rows = await listRows<MaterialRow>("get_admin_material_options", "Chargement des matériels impossible.")
  return rows
    .map((row) => ({
      id: row.id,
      name: cleanLabel(row.name),
      active: row.active === true,
      sortOrder: toNumber(row.sort_order),
      usageCount: toNumber(row.usage_count),
    }))
    .sort(compareOrder)
}

/** Every distinct material name typed on incidents, most used first. Names match the catalogue exactly. */
export async function fetchMaterialUsage(): Promise<MaterialUsage[]> {
  const rows = await listRows<MaterialUsageRow>(
    "get_material_usage_by_admin",
    "Chargement des usages de matériel impossible.",
  )
  return rows
    .map((row) => ({ materialName: cleanLabel(row.material_name), uses: toNumber(row.uses) }))
    .filter((row) => row.materialName !== "")
    .sort((a, b) => b.uses - a.uses || a.materialName.localeCompare(b.materialName, "fr"))
}

async function createCommune(name: string): Promise<void> {
  await writeRpc("create_commune_by_admin", { p_name: name }, "Ajout de la commune impossible.")
}

async function renameCommune(input: { id: string; name: string }): Promise<void> {
  await writeRpc("update_commune_by_admin", { p_id: input.id, p_name: input.name }, "Renommage de la commune impossible.")
}

async function deleteCommune(id: string): Promise<void> {
  await writeRpc("delete_commune_by_admin", { p_id: id }, "Suppression de la commune impossible.")
}

async function createIncidentType(input: { networkType: NetworkType; name: string }): Promise<void> {
  await writeRpc(
    "create_incident_type_option_by_admin",
    { p_network_type: input.networkType, p_name: input.name },
    "Ajout du type d'incident impossible.",
  )
}

async function saveIncidentType(input: IncidentTypeInput): Promise<void> {
  await writeRpc(
    "update_incident_type_option_by_admin",
    {
      p_id: input.id,
      p_network_type: input.networkType,
      p_name: input.name,
      p_active: input.active,
      p_sort_order: input.sortOrder,
    },
    "Mise à jour du type d'incident impossible.",
  )
}

async function deleteIncidentType(id: string): Promise<void> {
  await writeRpc("delete_incident_type_option_by_admin", { p_id: id }, "Suppression du type d'incident impossible.")
}

async function createDepartHta(name: string): Promise<void> {
  await writeRpc("create_depart_hta_option_by_admin", { p_name: name }, "Ajout du Départ HTA impossible.")
}

async function saveDepartHta(input: DepartHtaInput): Promise<void> {
  await writeRpc(
    "update_depart_hta_option_by_admin",
    { p_id: input.id, p_name: input.name, p_active: input.active, p_sort_order: input.sortOrder },
    "Mise à jour du Départ HTA impossible.",
  )
}

async function createMaterial(name: string): Promise<void> {
  await writeRpc("create_material_option_by_admin", { p_name: name }, "Ajout du matériel impossible.")
}

async function saveMaterial(input: MaterialInput): Promise<void> {
  await writeRpc(
    "update_material_option_by_admin",
    { p_id: input.id, p_name: input.name, p_active: input.active, p_sort_order: input.sortOrder },
    "Mise à jour du matériel impossible.",
  )
}

async function deleteMaterial(id: string): Promise<void> {
  await writeRpc("delete_material_option_by_admin", { p_id: id }, "Suppression du matériel impossible.")
}

/** Runs one write and then refreshes the given queries, also when the write failed. */
function useWriteMutation<TVariables>(
  write: (variables: TVariables) => Promise<void>,
  invalidations: readonly QueryKey[],
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: write,
    onSettled: () => Promise.all(invalidations.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

/**
 * Optimistic write for a cached list: `change` shows the new values at once, the snapshot is restored if the
 * write fails, and the queries are refreshed when it settles.
 */
function useOptimisticWrite<TVariables, TRow extends { id: string }>(
  write: (variables: TVariables) => Promise<void>,
  listKey: QueryKey,
  change: (rows: TRow[], variables: TVariables) => TRow[],
  invalidations: readonly QueryKey[],
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: write,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey: listKey })
      const previous = queryClient.getQueryData<TRow[]>(listKey)
      if (previous) queryClient.setQueryData<TRow[]>(listKey, change(previous, variables))
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData<TRow[]>(listKey, context.previous)
    },
    onSettled: () => Promise.all(invalidations.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

export function useCommunesAdmin() {
  return useQuery({ queryKey: REFERENCE_KEYS.communes, queryFn: fetchCommunes })
}

export function useCreateCommune() {
  return useWriteMutation(createCommune, COMMUNE_INVALIDATIONS)
}

export function useRenameCommune() {
  return useWriteMutation(renameCommune, COMMUNE_INVALIDATIONS)
}

export function useDeleteCommune() {
  return useWriteMutation(deleteCommune, COMMUNE_INVALIDATIONS)
}

export function useIncidentTypeOptions() {
  return useQuery({ queryKey: REFERENCE_KEYS.incidentTypes, queryFn: fetchIncidentTypes })
}

export function useCreateIncidentType() {
  return useWriteMutation(createIncidentType, INCIDENT_TYPE_INVALIDATIONS)
}

/** Toggling active or renaming shows at once; the list is restored if the save fails. */
export function useSaveIncidentType() {
  return useOptimisticWrite<IncidentTypeInput, IncidentTypeOption>(
    saveIncidentType,
    REFERENCE_KEYS.incidentTypes,
    (rows, input) => mergeRows(rows, [input], compareIncidentTypes),
    INCIDENT_TYPE_INVALIDATIONS,
  )
}

/** Saves the new sort order of several incident types at once; the rows move at once. */
export function useSaveIncidentTypeOrder() {
  return useOptimisticWrite<IncidentTypeInput[], IncidentTypeOption>(
    async (inputs) => {
      await Promise.all(inputs.map((input) => saveIncidentType(input)))
    },
    REFERENCE_KEYS.incidentTypes,
    (rows, inputs) => mergeRows(rows, inputs, compareIncidentTypes),
    INCIDENT_TYPE_INVALIDATIONS,
  )
}

export function useDeleteIncidentType() {
  return useWriteMutation(deleteIncidentType, INCIDENT_TYPE_INVALIDATIONS)
}

export function useDepartsHtaOptions() {
  return useQuery({ queryKey: REFERENCE_KEYS.departsHta, queryFn: fetchDepartsHta })
}

export function useCreateDepartHta() {
  return useWriteMutation(createDepartHta, DEPART_HTA_INVALIDATIONS)
}

/** Toggling active or renaming shows at once; the list is restored if the save fails. */
export function useSaveDepartHta() {
  return useOptimisticWrite<DepartHtaInput, DepartHtaOption>(
    saveDepartHta,
    REFERENCE_KEYS.departsHta,
    (rows, input) => mergeRows(rows, [input], compareOrder),
    DEPART_HTA_INVALIDATIONS,
  )
}

/** Saves the new sort order of several Départs HTA at once; the rows move at once. */
export function useSaveDepartHtaOrder() {
  return useOptimisticWrite<DepartHtaInput[], DepartHtaOption>(
    async (inputs) => {
      await Promise.all(inputs.map((input) => saveDepartHta(input)))
    },
    REFERENCE_KEYS.departsHta,
    (rows, inputs) => mergeRows(rows, inputs, compareOrder),
    DEPART_HTA_INVALIDATIONS,
  )
}

export function useMaterialOptions() {
  return useQuery({ queryKey: REFERENCE_KEYS.materials, queryFn: fetchMaterialOptions })
}

export function useMaterialUsage() {
  return useQuery({ queryKey: REFERENCE_KEYS.materialUsage, queryFn: fetchMaterialUsage })
}

export function useCreateMaterial() {
  return useWriteMutation(createMaterial, MATERIAL_INVALIDATIONS)
}

/** Toggling active or renaming shows at once; the list is restored if the save fails. */
export function useSaveMaterial() {
  return useOptimisticWrite<MaterialInput, MaterialOption>(
    saveMaterial,
    REFERENCE_KEYS.materials,
    (rows, input) => mergeRows(rows, [input], compareOrder),
    MATERIAL_INVALIDATIONS,
  )
}

/** Saves the new sort order of several materials at once; the rows move at once. */
export function useSaveMaterialOrder() {
  return useOptimisticWrite<MaterialInput[], MaterialOption>(
    async (inputs) => {
      await Promise.all(inputs.map((input) => saveMaterial(input)))
    },
    REFERENCE_KEYS.materials,
    (rows, inputs) => mergeRows(rows, inputs, compareOrder),
    MATERIAL_INVALIDATIONS,
  )
}

export function useDeleteMaterial() {
  return useWriteMutation(deleteMaterial, MATERIAL_INVALIDATIONS)
}
