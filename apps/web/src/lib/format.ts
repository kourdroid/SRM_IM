/** Time zone and locale used for every date and number shown in the dashboard. */
export const APP_TIME_ZONE = "Africa/Casablanca"
export const APP_LOCALE = "fr-MA"

type DateInput = Date | string | number

const dateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const dateLongFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
})

const timeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const dateTimeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const numberFormatter = new Intl.NumberFormat(APP_LOCALE)

const percentFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "percent",
  maximumFractionDigits: 1,
})

const EMPTY_VALUE = "—"

function toValidDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Formats a date as dd/mm/yyyy in Africa/Casablanca. */
export function formatDate(value: DateInput): string {
  const date = toValidDate(value)
  return date ? dateFormatter.format(date) : EMPTY_VALUE
}

/** Formats a date as a long French date, e.g. 13 novembre 2026. */
export function formatDateLong(value: DateInput): string {
  const date = toValidDate(value)
  return date ? dateLongFormatter.format(date) : EMPTY_VALUE
}

/** Formats the time of day as HH:mm in Africa/Casablanca. */
export function formatTime(value: DateInput): string {
  const date = toValidDate(value)
  return date ? timeFormatter.format(date) : EMPTY_VALUE
}

/** Formats a date and time as dd/mm/yyyy HH:mm in Africa/Casablanca. */
export function formatDateTime(value: DateInput): string {
  const date = toValidDate(value)
  return date ? dateTimeFormatter.format(date) : EMPTY_VALUE
}

/** Formats an integer or decimal with French grouping separators. */
export function formatNumber(value: number): string {
  return Number.isFinite(value) ? numberFormatter.format(value) : EMPTY_VALUE
}

/** Formats a ratio (0 to 1) as a French percentage, e.g. 12,5 %. */
export function formatPercent(ratio: number): string {
  return Number.isFinite(ratio) ? percentFormatter.format(ratio) : EMPTY_VALUE
}

/** Returns up to two initials from a display name, for avatars. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return (first + last).toUpperCase()
}
