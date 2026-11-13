import { Zap } from "lucide-react"

import { cn } from "@/lib/utils"

/** Intervx logo: lime bolt on a navy tile, optionally with the wordmark. */
export function BrandMark({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy text-lime dark:bg-secondary">
        <Zap className="size-5 fill-current" aria-hidden="true" />
      </span>
      {showWordmark ? <span className="text-base font-semibold tracking-tight">Intervx</span> : null}
    </div>
  )
}
