import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { cleanLabel, type Network } from "@/data/incidents"
import { describeError, throwIfError } from "@/lib/rpc"
import { supabase } from "@/lib/supabase"

/**
 * Admin write layer for incidents: reference options and the mutations behind the incident actions.
 * Every write goes through a server RPC (validated and audited there); the hooks only shape payloads,
 * show the result as a toast and refresh every query under the ["incidents"] key.
 */

const OPTIONS_STALE_MS = 5 * 60 * 1000

export type IncidentTypeOption = {
  id: string
  network: Network
  name: string
  active: boolean
}

export type DepartHtaOption = {
  id: string
  name: string
  active: boolean
}

/** One material line as stored on an incident. */
export type MaterialLine = {
  materialName: string
  quantity: number
}

export type IncidentDetailsDraft = {
  incidentType: string
  departHta: string | null
  communeId: string
  village: string
  description: string
  reclamation: boolean
  reclamationName: string | null
  reclamationBy: string | null
}

type RpcIncidentTypeRow = {
  id: string
  network_type: Network
  name: string | null
  active: boolean | null
}

type RpcDepartHtaRow = {
  id: string
  name: string | null
  active: boolean | null
}

/** Incident types for both networks; the caller filters by the incident's network. */
export function useIncidentTypeOptions(enabled = true) {
  return useQuery({
    queryKey: ["incident-options", "types"],
    enabled,
    staleTime: OPTIONS_STALE_MS,
    queryFn: async (): Promise<IncidentTypeOption[]> => {
      const { data, error } = await supabase.rpc("get_admin_incident_type_options")
      throwIfError(error, "Chargement des types d'incident impossible.")
      return ((data ?? []) as RpcIncidentTypeRow[]).map((row) => ({
        id: row.id,
        network: row.network_type,
        name: cleanLabel(row.name),
        active: row.active === true,
      }))
    },
  })
}

/** Départs HTA, used by MT incidents only. */
export function useDepartHtaOptions(enabled = true) {
  return useQuery({
    queryKey: ["incident-options", "depart-hta"],
    enabled,
    staleTime: OPTIONS_STALE_MS,
    queryFn: async (): Promise<DepartHtaOption[]> => {
      const { data, error } = await supabase.rpc("get_admin_depart_hta_options")
      throwIfError(error, "Chargement des départs HTA impossible.")
      return ((data ?? []) as RpcDepartHtaRow[]).map((row) => ({
        id: row.id,
        name: cleanLabel(row.name),
        active: row.active === true,
      }))
    },
  })
}

/** Names of the active materials catalog, in the catalog's display order. */
export function useMaterialCatalog(enabled = true) {
  return useQuery({
    queryKey: ["incident-options", "materials"],
    enabled,
    staleTime: OPTIONS_STALE_MS,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc("get_admin_material_options")
      throwIfError(error, "Chargement du catalogue de matériel impossible.")
      return ((data ?? []) as { name: string | null; active: boolean | null }[])
        .filter((row) => row.active === true)
        .map((row) => cleanLabel(row.name))
        .filter((name) => name !== "")
    },
  })
}

/** Materials currently recorded on one incident. Lives under the ["incidents"] key so writes refresh it. */
export function useIncidentMaterials(incidentId: string, enabled = true) {
  return useQuery({
    queryKey: ["incidents", "materials", incidentId],
    enabled,
    queryFn: async (): Promise<MaterialLine[]> => {
      const { data, error } = await supabase
        .from("incident_materials")
        .select("material_name, quantity")
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: true })
      throwIfError(error, "Chargement du matériel impossible.")
      return ((data ?? []) as { material_name: string | null; quantity: number | string | null }[]).map((row) => ({
        materialName: cleanLabel(row.material_name),
        quantity: Number(row.quantity),
      }))
    },
  })
}

/** Refreshes every incident query (lists, map, overview, detail materials). */
function useRefreshIncidents() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ["incidents"] })
}

export type UpdateIncidentDetailsInput = IncidentDetailsDraft & { incidentId: string }

/** Corrects the descriptive fields of an open or closed incident (update_incident_by_admin). */
export function useUpdateIncidentDetails() {
  const refresh = useRefreshIncidents()
  return useMutation({
    mutationFn: async (input: UpdateIncidentDetailsInput) => {
      const { data, error } = await supabase.rpc("update_incident_by_admin", {
        p_incident_id: input.incidentId,
        p_incident_type: input.incidentType,
        p_depart_hta: input.departHta,
        p_commune_id: input.communeId,
        p_village: input.village,
        p_description: input.description,
        p_reclamation: input.reclamation,
        p_reclamation_name: input.reclamationName,
        p_reclamation_by: input.reclamationBy,
      })
      throwIfError(error)
      if (data !== input.incidentId) throw new Error("La modification n'a pas été enregistrée.")
    },
    onSuccess: () => {
      toast.success("Incident modifié.")
      void refresh()
    },
    onError: (error) => toast.error(describeError(error)),
  })
}

export type IncidentMaterialsInput = {
  incidentId: string
  materials: MaterialLine[]
  noMaterialUsed: boolean
}

/** Replaces the material list of an incident (update_incident_materials_by_admin). */
export function useUpdateIncidentMaterials() {
  const refresh = useRefreshIncidents()
  return useMutation({
    mutationFn: async (input: IncidentMaterialsInput) => {
      const { error } = await supabase.rpc("update_incident_materials_by_admin", {
        p_incident_id: input.incidentId,
        p_materials: input.materials.map((line) => ({ material_name: line.materialName, quantity: line.quantity })),
        p_no_material_used: input.noMaterialUsed,
      })
      throwIfError(error)
    },
    onSuccess: () => {
      toast.success("Matériel mis à jour.")
      void refresh()
    },
    onError: (error) => toast.error(describeError(error)),
  })
}

/** Closes an open incident with its materials, or with an explicit "no material" declaration. */
export function useCloseIncident() {
  const refresh = useRefreshIncidents()
  return useMutation({
    mutationFn: async (input: IncidentMaterialsInput) => {
      const { data, error } = await supabase.rpc("close_incident_with_materials", {
        p_incident_id: input.incidentId,
        p_materials: input.materials.map((line) => ({
          client_material_id: crypto.randomUUID(),
          material_name: line.materialName,
          quantity: line.quantity,
        })),
        p_no_material_used: input.noMaterialUsed,
      })
      throwIfError(error)
      if (data !== input.incidentId) throw new Error("La clôture n'a pas été enregistrée.")
    },
    onSuccess: () => {
      toast.success("Incident clôturé.")
      void refresh()
    },
    onError: (error) => toast.error(describeError(error)),
  })
}

/** Reopens a closed incident and clears its "no material" declaration. */
export function useReopenIncident() {
  const refresh = useRefreshIncidents()
  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { data, error } = await supabase
        .from("incidents")
        .update({ status: "open", no_material_used: false })
        .eq("id", incidentId)
        .select("id")
        .single()
      throwIfError(error)
      if (!data) throw new Error("Incident absent ou accès refusé.")
    },
    onSuccess: () => {
      toast.success("Incident rouvert.")
      void refresh()
    },
    onError: (error) => toast.error(describeError(error)),
  })
}

/** Soft delete: the incident leaves every list, statistic and report; its history is kept. */
export function useArchiveIncident() {
  const refresh = useRefreshIncidents()
  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { error } = await supabase.rpc("archive_incident", { p_incident_id: incidentId })
      throwIfError(error)
    },
    onSuccess: () => {
      toast.success("Incident supprimé.")
      void refresh()
    },
    onError: (error) => toast.error(describeError(error)),
  })
}
