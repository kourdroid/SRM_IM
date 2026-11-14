import { Skeleton } from "@/components/ui/skeleton"

/** Loading placeholder shaped like the KPI row and the users table. */
export function UsersSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Chargement des utilisateurs</span>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-soft">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
