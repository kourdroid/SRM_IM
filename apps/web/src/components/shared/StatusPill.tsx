import { cn } from "@/lib/utils"

/** Incident status: "En cours" (warning tint) or "Clôturé" (success tint), with a dot. */
export function StatusPill({ status }: { status: "open" | "closed" }) {
  const isOpen = status === "open"

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        isOpen ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
      )}
    >
      <span className={cn("size-1.5 rounded-full", isOpen ? "bg-warning" : "bg-success")} aria-hidden="true" />
      {isOpen ? "En cours" : "Clôturé"}
    </span>
  )
}
