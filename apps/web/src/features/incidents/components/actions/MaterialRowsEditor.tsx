import { Plus, Trash2 } from "lucide-react"
import { useId } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

import { createMaterialRow, MATERIAL_NAME_MAX_LENGTH, type MaterialRow, type MaterialUsage } from "./material-rows"

const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-center gap-2"

/**
 * Editable list of material lines (name and quantity). Names are suggested from the materials catalog
 * through a native datalist, so an unlisted name can still be typed; it is checked when saving.
 */
export function MaterialRowsEditor({
  rows,
  catalog,
  onChange,
  disabled = false,
}: {
  rows: MaterialRow[]
  catalog: readonly string[]
  onChange: (rows: MaterialRow[]) => void
  disabled?: boolean
}) {
  const listId = useId()

  const patchRow = (id: string, patch: Partial<Pick<MaterialRow, "name" | "quantity">>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 ? (
        <div className={cn(ROW_GRID, "px-1 text-xs font-medium text-muted-foreground")} aria-hidden="true">
          <span>Matériel</span>
          <span>Quantité</span>
          <span className="sr-only">Action</span>
        </div>
      ) : (
        <p className="rounded-xl bg-muted/50 px-3.5 py-3 text-sm text-muted-foreground">Aucun matériel ajouté.</p>
      )}

      {rows.map((row, index) => (
        <div key={row.id} className={ROW_GRID}>
          <Input
            list={listId}
            value={row.name}
            maxLength={MATERIAL_NAME_MAX_LENGTH}
            placeholder="Nom du matériel"
            aria-label={`Nom du matériel ${index + 1}`}
            autoComplete="off"
            disabled={disabled}
            onChange={(event) => patchRow(row.id, { name: event.target.value })}
          />
          <Input
            inputMode="decimal"
            value={row.quantity}
            placeholder="Qté"
            aria-label={`Quantité du matériel ${index + 1}`}
            autoComplete="off"
            disabled={disabled}
            onChange={(event) => patchRow(row.id, { quantity: event.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Retirer le matériel ${index + 1}`}
            disabled={disabled}
            className="text-muted-foreground"
            onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ))}

      <datalist id={listId}>
        {catalog.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        disabled={disabled}
        onClick={() => onChange([...rows, createMaterialRow()])}
      >
        <Plus aria-hidden="true" />
        Ajouter un matériel
      </Button>
    </div>
  )
}

/** Two-way choice for closed incidents and for closing: with materials, or explicitly none. */
export function MaterialUsageChoice({
  value,
  onChange,
  disabled = false,
  noneDisabled = false,
}: {
  value: MaterialUsage | null
  onChange: (value: MaterialUsage) => void
  disabled?: boolean
  noneDisabled?: boolean
}) {
  return (
    <ToggleGroup
      type="single"
      spacing={2}
      aria-label="Matériel utilisé"
      value={value ?? ""}
      disabled={disabled}
      className="w-full"
      onValueChange={(next) => {
        if (next === "with" || next === "none") onChange(next)
      }}
    >
      <ToggleGroupItem
        value="with"
        className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        Avec matériel
      </ToggleGroupItem>
      <ToggleGroupItem
        value="none"
        disabled={noneDisabled}
        className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        Aucun matériel utilisé
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
