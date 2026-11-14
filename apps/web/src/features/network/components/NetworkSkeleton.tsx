import { Skeleton } from "@/components/ui/skeleton"

const SKELETON_ROWS = 8

/** Loading placeholder shaped like the KPI row and the grouped table. */
export function NetworkSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Chargement des postes et départs</span>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-36 rounded-lg" />
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-lg bg-card p-4 shadow-soft">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
