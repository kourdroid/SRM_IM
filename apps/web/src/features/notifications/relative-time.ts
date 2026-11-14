import { formatDateTime } from "@/lib/format"

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS

const relativeFormatter = new Intl.RelativeTimeFormat("fr", { numeric: "auto" })

/**
 * French relative time ("il y a 5 minutes", "hier"). Beyond a week the absolute date and time are shown instead.
 * `now` is passed in (epoch ms) so the caller decides when labels refresh.
 */
export function formatRelativeTime(iso: string, now: number): string {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return "—"

  const diff = time - now
  const elapsed = Math.abs(diff)
  if (elapsed < MINUTE_MS) return "à l'instant"
  if (elapsed < HOUR_MS) return relativeFormatter.format(Math.round(diff / MINUTE_MS), "minute")
  if (elapsed < DAY_MS) return relativeFormatter.format(Math.round(diff / HOUR_MS), "hour")
  if (elapsed < WEEK_MS) return relativeFormatter.format(Math.round(diff / DAY_MS), "day")
  return formatDateTime(iso)
}
