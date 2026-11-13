import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

/** Placeholder block for pages or lists without content yet. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-muted/50 px-6 py-14 text-center">
      {Icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-card shadow-soft">
          <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
        </span>
      ) : null}
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  )
}
