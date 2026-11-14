import { Fragment } from "react"

const HINTS = [
  { keys: "↑↓", label: "naviguer" },
  { keys: "↵", label: "ouvrir" },
  { keys: "Échap", label: "fermer" },
] as const

/** Decorative keyboard hints shown at the bottom of the command palette. */
export function CommandFooter() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 rounded-b-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
    >
      {HINTS.map((hint, index) => (
        <Fragment key={hint.keys}>
          {index > 0 ? <span>·</span> : null}
          <span className="flex items-center gap-1.5">
            <kbd className="rounded bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {hint.keys}
            </kbd>
            {hint.label}
          </span>
        </Fragment>
      ))}
    </div>
  )
}
