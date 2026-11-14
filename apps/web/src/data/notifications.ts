import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { cleanLabel, type IncidentStatus, type Network } from "@/data/incidents"
import { describeError, throwIfError } from "@/lib/rpc"
import { supabase } from "@/lib/supabase"

/**
 * Admin notification inbox. Rows are the signed-in recipient's own (row-level security); acknowledging goes
 * through the acknowledge_admin_notification RPC because the table is read-only for the client.
 */

export type NotificationIncident = {
  network: Network
  incidentType: string
  village: string
  /** Incident date (YYYY-MM-DD). */
  date: string
  departHta: string | null
  status: IncidentStatus
  commune: string
}

export type AdminNotification = {
  id: string
  incidentId: string
  createdAt: string
  acknowledgedAt: string | null
  /** Null when the linked incident is no longer visible to the reader. */
  incident: NotificationIncident | null
}

export const NOTIFICATION_PAGE_SIZE = 30

/** Batch size when acknowledging everything; each acknowledge is one RPC call. */
const ACKNOWLEDGE_BATCH = 25
/** Safety bound for "mark all as read" (25 x 200 = 5 000 notifications per click). */
const ACKNOWLEDGE_MAX_BATCHES = 200

const NOTIFICATION_COLUMNS =
  "id, incident_id, created_at, acknowledged_at, incidents!inner(type, incident_type, village, date, depart_hta, status, communes(name))"

type NotificationsOptions = {
  unreadOnly: boolean
  limit: number
}

/**
 * Notifications, unread first (acknowledged_at nulls first), then newest first.
 * The list grows by requesting a larger limit: the first N rows of this order are stable.
 */
export function useNotifications({ unreadOnly, limit }: NotificationsOptions) {
  return useQuery({
    queryKey: ["notifications", "list", { unreadOnly, limit }],
    queryFn: async (): Promise<AdminNotification[]> => {
      let query = supabase.from("admin_notifications").select(NOTIFICATION_COLUMNS)
      if (unreadOnly) query = query.is("acknowledged_at", null)
      const { data, error } = await query
        .order("acknowledged_at", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(0, limit - 1)
      throwIfError(error, "Impossible de charger les notifications. Vérifiez votre connexion.")
      return (Array.isArray(data) ? data : []).flatMap((row) => {
        const notification = parseNotification(row)
        return notification ? [notification] : []
      })
    },
  })
}

/** Number of unread notifications whose incident is still visible (drives the counter and the bulk action). */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("admin_notifications")
        .select("id, incidents!inner(id)", { count: "exact", head: true })
        .is("acknowledged_at", null)
      throwIfError(error, "Le nombre de notifications non lues est indisponible.")
      return count ?? 0
    },
  })
}

/** Marks one notification as read. Errors are reported with a toast. */
export function useAcknowledgeNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: acknowledgeNotification,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (error) => toast.error(describeError(error, "La prise en compte a échoué. Réessayez.")),
  })
}

/** Marks every unread notification as read, batch by batch, until none is left. */
export function useAcknowledgeAllNotifications() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: acknowledgeAllNotifications,
    onSuccess: (count) => {
      if (count > 0) toast.success(count === 1 ? "1 notification marquée comme lue." : `${count} notifications marquées comme lues.`)
      return queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
    onError: (error) => {
      toast.error(describeError(error, "Les notifications n'ont pas toutes pu être marquées comme lues."))
      void queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
  })
}

async function acknowledgeNotification(id: string): Promise<void> {
  const { error } = await supabase.rpc("acknowledge_admin_notification", { p_notification_id: id })
  throwIfError(error, "La prise en compte a échoué. Vérifiez votre connexion et réessayez.")
}

async function acknowledgeAllNotifications(): Promise<number> {
  let acknowledged = 0
  for (let batch = 0; batch < ACKNOWLEDGE_MAX_BATCHES; batch += 1) {
    const { data, error } = await supabase
      .from("admin_notifications")
      .select("id")
      .is("acknowledged_at", null)
      .limit(ACKNOWLEDGE_BATCH)
    throwIfError(error, "Impossible de charger les notifications non lues.")

    const ids = (Array.isArray(data) ? data : []).map((row) => readId(row)).filter((id): id is string => id !== null)
    if (ids.length === 0) return acknowledged

    for (let start = 0; start < ids.length; start += ACKNOWLEDGE_BATCH) {
      await Promise.all(ids.slice(start, start + ACKNOWLEDGE_BATCH).map((id) => acknowledgeNotification(id)))
    }
    acknowledged += ids.length
  }
  throw new Error("Trop de notifications à traiter d'un coup. Relancez l'action.")
}

function readId(value: unknown): string | null {
  if (value === null || typeof value !== "object") return null
  const id = (value as { id?: unknown }).id
  return typeof id === "string" ? id : null
}

function parseNotification(value: unknown): AdminNotification | null {
  if (value === null || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const id = asText(row.id)
  const incidentId = asText(row.incident_id)
  const createdAt = asText(row.created_at)
  if (!id || !incidentId || !createdAt) return null

  const incidentRow = firstOf(row.incidents)
  return {
    id,
    incidentId,
    createdAt,
    acknowledgedAt: asNullableText(row.acknowledged_at),
    incident: incidentRow ? parseIncident(incidentRow) : null,
  }
}

function parseIncident(row: Record<string, unknown>): NotificationIncident {
  const commune = firstOf(row.communes)
  return {
    network: row.type === "MT" ? "MT" : "BT",
    incidentType: cleanLabel(asText(row.incident_type)),
    village: cleanLabel(asText(row.village)),
    date: asText(row.date),
    departHta: asNullableText(row.depart_hta) ? cleanLabel(asText(row.depart_hta)) : null,
    status: row.status === "closed" ? "closed" : "open",
    commune: cleanLabel(asText(commune?.name)) || "Commune inconnue",
  }
}

/** PostgREST returns to-one embeds as objects; tolerate a single-element array too. */
function firstOf(value: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate !== null && typeof candidate === "object" ? (candidate as Record<string, unknown>) : null
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asNullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}
