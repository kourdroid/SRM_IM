import type { ReactNode } from "react"

/** One label and value pair inside a settings card; stacks on phones, aligns side by side from sm. */
export function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium break-words sm:text-right">{children}</dd>
    </div>
  )
}
