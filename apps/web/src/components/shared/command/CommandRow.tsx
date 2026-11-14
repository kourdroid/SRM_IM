import type { ReactNode } from "react"

/** Two-line layout for a command item: leading slot, truncated title and description, trailing slot. */
export function CommandRow({
  leading,
  title,
  description,
  trailing,
}: {
  leading?: ReactNode
  title: string
  description?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="flex w-full min-w-0 items-center gap-3">
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  )
}
