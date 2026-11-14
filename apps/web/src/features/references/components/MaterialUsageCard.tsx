import { ChartNoAxesColumn, TriangleExclamationPoint } from "lucide-react"
import { useMemo, type ReactNode } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/EmptyState"
import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useCreateMaterial,
  useMaterialOptions,
  useMaterialUsage,
  type MaterialOption,
  type MaterialUsage,
} from "@/data/references"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  buildMaterialUsageEntries,
  errorMessage,
  type MaterialUsageEntry,
} from "@/features/references/reference-utils"

const NO_USAGE: MaterialUsage[] = []
const NO_MATERIALS: MaterialOption[] = []
const TOP_LIMIT = 10

/**
 * Most typed material names on incidents. Names that do not match the catalogue (after case and accent
 * normalization) are flagged "Hors catalogue", so spelling variants stand out and can be added in one click.
 */
export function MaterialUsageCard() {
  const usageQuery = useMaterialUsage()
  const catalogQuery = useMaterialOptions()
  const createMaterial = useCreateMaterial()

  const usage = usageQuery.data ?? NO_USAGE
  const catalog = catalogQuery.data ?? NO_MATERIALS
  const entries = useMemo(
    () => buildMaterialUsageEntries(usage, catalog.map((material) => material.name)),
    [usage, catalog],
  )

  const failure = usageQuery.isError ? usageQuery.error : catalogQuery.isError ? catalogQuery.error : null
  const loading = usageQuery.isPending || catalogQuery.isPending
  const freeCount = entries.filter((entry) => !entry.inCatalog).length

  function retry() {
    void usageQuery.refetch()
    void catalogQuery.refetch()
  }

  function addToCatalog(label: string) {
    createMaterial.mutate(label, {
      onSuccess: () => toast.success(`« ${label} » ajouté au catalogue.`),
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  let body: ReactNode
  if (failure) {
    body = (
      <EmptyState
        icon={TriangleExclamationPoint}
        title="Chargement impossible"
        description={errorMessage(failure, "Chargement impossible.")}
        action={
          <Button variant="secondary" onClick={retry}>
            Réessayer
          </Button>
        }
      />
    )
  } else if (loading) {
    body = (
      <div role="status" aria-live="polite" className="flex flex-col gap-3">
        <span className="sr-only">Chargement de l'utilisation</span>
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    )
  } else if (entries.length === 0) {
    body = (
      <EmptyState
        icon={ChartNoAxesColumn}
        title="Aucune saisie de matériel"
        description="Les noms saisis sur les incidents apparaîtront ici."
      />
    )
  } else {
    const top = entries.slice(0, TOP_LIMIT)
    const maxUses = Math.max(1, ...top.map((entry) => entry.uses))

    body = (
      <div className="flex flex-col gap-4">
        {freeCount > 0 ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-warning/10 p-3 text-sm text-warning">
            <TriangleExclamationPoint className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              {formatNumber(freeCount)} {freeCount > 1 ? "noms" : "nom"} hors catalogue.{" "}
              {freeCount > 1 ? "Ajoutez-les" : "Ajoutez-le"} au catalogue pour les proposer aux agents.
            </p>
          </div>
        ) : null}

        <ul className="flex flex-col gap-4">
          {top.map((entry) => (
            <UsageRow
              key={entry.key}
              entry={entry}
              maxUses={maxUses}
              adding={createMaterial.isPending && createMaterial.variables === entry.label}
              disabled={createMaterial.isPending}
              onAddToCatalog={() => addToCatalog(entry.label)}
            />
          ))}
        </ul>

        {entries.length > TOP_LIMIT ? (
          <p className="text-xs text-muted-foreground">Seuls les {TOP_LIMIT} noms les plus utilisés sont affichés.</p>
        ) : null}
      </div>
    )
  }

  return (
    <SectionCard title="Utilisation" description="Noms saisis sur les incidents, du plus utilisé au moins utilisé.">
      {body}
    </SectionCard>
  )
}

function UsageRow({
  entry,
  maxUses,
  adding,
  disabled,
  onAddToCatalog,
}: {
  entry: MaterialUsageEntry
  maxUses: number
  adding: boolean
  disabled: boolean
  onAddToCatalog: () => void
}) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate font-medium" title={entry.label}>
            {entry.label}
          </span>
          {entry.inCatalog ? null : (
            <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
              Hors catalogue
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {entry.inCatalog ? null : (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-foreground [@media(pointer:coarse)]:h-11"
              disabled={disabled}
              onClick={onAddToCatalog}
            >
              {adding ? "Ajout…" : "+ Ajouter"}
              <span className="sr-only"> {entry.label} au catalogue</span>
            </Button>
          )}
          <span className="w-8 text-right tabular-nums text-muted-foreground">{formatNumber(entry.uses)}</span>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn("h-full rounded-full", entry.inCatalog ? "bg-foreground/70" : "bg-warning")}
          style={{ width: `${(entry.uses / maxUses) * 100}%` }}
        />
      </div>
      {entry.spellings > 1 ? (
        <span className="text-xs text-muted-foreground">{formatNumber(entry.spellings)} orthographes regroupées</span>
      ) : null}
    </li>
  )
}
