import type { ReactNode } from "react"

/**
 * One label and value pair inside a settings card. Stacks on phones, aligns side by side from sm.
 * Rows share the same vertical rhythm and are separated by a soft line; the first row has none.
 */
export function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-foreground/[0.04] py-2.5 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium break-words sm:text-right">{children}</dd>
    </div>
  )
}
