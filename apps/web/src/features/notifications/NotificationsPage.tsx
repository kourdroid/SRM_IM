import { Bell, BellOff, CheckCheck, TriangleAlert } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/shared/PageHeader"
import { SegmentedControl, type SegmentedOption } from "@/components/shared/SegmentedControl"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  NOTIFICATION_PAGE_SIZE,
  useAcknowledgeAllNotifications,
  useAcknowledgeNotification,
  useNotifications,
  useUnreadNotificationCount,
} from "@/data/notifications"
import { formatNumber } from "@/lib/format"
import { NotificationItem } from "@/features/notifications/components/NotificationItem"

type InboxFilter = "unread" | "all"

const FILTER_OPTIONS: SegmentedOption<InboxFilter>[] = [
  { value: "unread", label: "Non lues", ariaLabel: "Afficher les notifications non lues" },
  { value: "all", label: "Toutes", ariaLabel: "Afficher toutes les notifications" },
]

const SKELETON_ROWS = 5

/** Admin inbox: unread notifications first, bulk "mark all as read", and a link from each row to its incident. */
export function NotificationsPage() {
  const [filter, setFilter] = useState<InboxFilter>("unread")
  const [limit, setLimit] = useState(NOTIFICATION_PAGE_SIZE)
  const [now, setNow] = useState(() => Date.now())

  const inbox = useNotifications({ unreadOnly: filter === "unread", limit })
  const unreadCount = useUnreadNotificationCount()
  const acknowledge = useAcknowledgeNotification()
  const acknowledgeAll = useAcknowledgeAllNotifications()

  // Relative labels ("il y a 5 minutes") drift while the page stays open.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const unread = unreadCount.data ?? 0
  const items = inbox.data ?? []
  const hasMore = items.length === limit

  function changeFilter(next: InboxFilter) {
    setFilter(next)
    setLimit(NOTIFICATION_PAGE_SIZE)
  }

  let body: ReactNode
  if (inbox.isPending) {
    body = (
      <Card className="gap-0 py-2" aria-busy="true">
        <ul className="flex flex-col gap-1 px-1">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index} className="flex min-h-11 items-start gap-3 px-5 py-3">
              <Skeleton className="mt-1.5 size-2 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    )
  } else if (inbox.isError) {
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Chargement impossible"
        description={inbox.error instanceof Error ? inbox.error.message : undefined}
        action={<Button onClick={() => void inbox.refetch()}>Réessayer</Button>}
      />
    )
  } else if (items.length === 0) {
    body = filter === "unread" ? (
      <EmptyState
        icon={BellOff}
        title="Aucune notification non lue"
        description="Vous êtes à jour. Les nouveaux incidents apparaîtront ici."
      />
    ) : (
      <EmptyState
        icon={Bell}
        title="Aucune notification"
        description="Les incidents signalés par les agents apparaîtront ici."
      />
    )
  } else {
    body = (
      <Card className="gap-0 py-2">
        <ul aria-label="Notifications" className="flex flex-col gap-1 px-1">
          {items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              now={now}
              onAcknowledge={(id) => acknowledge.mutate(id)}
              acknowledging={acknowledge.isPending || acknowledgeAll.isPending}
            />
          ))}
        </ul>
        {hasMore ? (
          <div className="flex justify-center px-5 pt-3">
            <Button variant="ghost" onClick={() => setLimit((current) => current + NOTIFICATION_PAGE_SIZE)}>
              Afficher plus
            </Button>
          </div>
        ) : null}
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description={unreadCount.isPending ? "Chargement…" : unread === 0 ? "Aucune notification non lue" : `${formatNumber(unread)} non lue${unread > 1 ? "s" : ""}`}
        actions={
          <>
            <SegmentedControl<InboxFilter>
              ariaLabel="Filtrer les notifications"
              value={filter}
              onValueChange={changeFilter}
              options={FILTER_OPTIONS}
            />
            <Button
              variant="secondary"
              disabled={unread === 0 || acknowledgeAll.isPending || unreadCount.isPending}
              onClick={() => acknowledgeAll.mutate()}
            >
              <CheckCheck aria-hidden="true" />
              {acknowledgeAll.isPending ? "Mise à jour…" : "Tout marquer comme lu"}
            </Button>
          </>
        }
      />

      {body}
    </div>
  )
}
