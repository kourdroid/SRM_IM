import { Check } from "lucide-react"
import { Link } from "react-router"

import { NetworkBadge } from "@/components/shared/NetworkBadge"
import { StatusPill } from "@/components/shared/StatusPill"
import { Button } from "@/components/ui/button"
import type { AdminNotification } from "@/data/notifications"
import { formatDate, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/features/notifications/relative-time"

/** One inbox row: unread state, the incident summary and a link to the incident. Opening an unread row marks it as read. */
export function NotificationItem({
  notification,
  now,
  onAcknowledge,
  acknowledging,
}: {
  notification: AdminNotification
  /** Epoch ms used for the relative time label. */
  now: number
  onAcknowledge: (id: string) => void
  acknowledging: boolean
}) {
  const unread = notification.acknowledgedAt === null
  const incident = notification.incident
  const title = incident ? `${incident.incidentType} · ${incident.village || "Village inconnu"}` : "Incident indisponible"
  const relative = formatRelativeTime(notification.createdAt, now)

  return (
    <li
      className={cn(
        "flex min-h-11 items-start gap-3 rounded-xl px-5 py-3 transition-colors",
        unread ? "bg-primary/5" : "hover:bg-muted/60",
      )}
    >
      <span aria-hidden="true" className="flex h-5 shrink-0 items-center">
        <span className={cn("size-2 rounded-full", unread ? "bg-primary" : "bg-transparent")} />
      </span>

      <Link
        to={`/incidents?incident=${encodeURIComponent(notification.incidentId)}`}
        onClick={() => {
          if (unread) onAcknowledge(notification.id)
        }}
        className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="sr-only">{unread ? "Non lue : " : "Lue : "}</span>
        <span className="flex flex-wrap items-center gap-2">
          {incident ? <NetworkBadge network={incident.network} /> : null}
          <span className={cn("min-w-0 text-sm", unread ? "font-semibold" : "font-medium")}>{title}</span>
        </span>

        {incident ? (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{incident.commune}</span>
            {incident.departHta ? <span>· Départ {incident.departHta}</span> : null}
            <span>· Incident du {formatDate(incident.date)}</span>
            <StatusPill status={incident.status} />
          </span>
        ) : null}
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        <time
          dateTime={notification.createdAt}
          title={formatDateTime(notification.createdAt)}
          className="whitespace-nowrap pt-0.5 text-xs tabular-nums text-muted-foreground"
        >
          {relative}
        </time>
        {unread ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Marquer cette notification comme lue"
            title="Marquer comme lue"
            disabled={acknowledging}
            onClick={() => onAcknowledge(notification.id)}
          >
            <Check aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </li>
  )
}
