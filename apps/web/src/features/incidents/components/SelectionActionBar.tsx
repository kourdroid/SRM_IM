import { Download, Map as MapIcon, X } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"

/**
 * Floating bar shown while at least one incident is selected. Soft navy surface in light mode,
 * card surface in dark mode.
 */
export function SelectionActionBar({
  count,
  mapHref,
  onExport,
  onClear,
}: {
  count: number
  mapHref: string
  onExport: () => void
  onClear: () => void
}) {
  const label = count === 1 ? "1 incident sélectionné" : `${formatNumber(count)} incidents sélectionnés`

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div
        role="region"
        aria-label="Actions sur la sélection"
        className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-navy p-2 pl-4 text-white shadow-soft-lg dark:bg-card dark:text-card-foreground"
      >
        <p className="mr-1 text-sm font-medium tabular-nums">{label}</p>
        <Button
          size="sm"
          onClick={onExport}
          className="bg-lime text-navy hover:bg-lime/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
        >
          <Download aria-hidden="true" />
          Exporter la sélection
        </Button>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-white hover:bg-white/10 hover:text-white dark:text-foreground dark:hover:bg-muted"
        >
          <Link to={mapHref}>
            <MapIcon aria-hidden="true" />
            Voir sur la carte
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-white hover:bg-white/10 hover:text-white dark:text-foreground dark:hover:bg-muted"
        >
          <X aria-hidden="true" />
          Annuler
        </Button>
      </div>
    </div>
  )
}
