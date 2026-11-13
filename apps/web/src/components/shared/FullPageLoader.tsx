import { LoaderCircle } from "lucide-react"

/** Centered spinner with a French label, used while the session is being checked. */
export function FullPageLoader({ label }: { label: string }) {
  return (
    <div role="status" className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
