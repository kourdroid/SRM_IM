import { PageHeader } from "@/components/shared/PageHeader"

import { MaterialUsageCard } from "./components/MaterialUsageCard"
import { MaterialsPanel } from "./components/MaterialsPanel"

/** Admin page for the material catalogue, with the typed names on incidents next to it. */
export function MaterialsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Matériels"
        description="Liste proposée aux agents à la clôture des incidents."
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <MaterialsPanel />
        </div>
        <MaterialUsageCard />
      </div>
    </div>
  )
}
