import type { ModuleItem } from "@/app/modules"

import { EmptyState } from "./EmptyState"
import { PageHeader } from "./PageHeader"

/** Generic placeholder for modules whose status is 'soon'. */
export function ComingSoonPage({ module }: { module: ModuleItem }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={module.label} description="Ce module est en cours de préparation." />
      <EmptyState
        icon={module.icon}
        title="Bientôt disponible"
        description={`Le module « ${module.label} » sera ajouté dans une prochaine version.`}
      />
    </div>
  )
}
