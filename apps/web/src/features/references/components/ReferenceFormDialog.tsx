import { useId, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cleanLabel } from "@/data/incidents"
import type { NetworkType } from "@/data/references"
import { errorMessage, validateReferenceName } from "@/features/references/reference-utils"

export type ReferenceFormValues = {
  name: string
  networkType?: NetworkType
}

export type ReferenceFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel: string
  nameLabel: string
  namePlaceholder: string
  initialName: string
  maxLength: number
  /** Adds a network choice (incident types). `lockedReason` disables it and explains why. */
  network?: { initial: NetworkType; lockedReason?: string }
  /** Disables the name field and explains why. */
  nameLockedReason?: string
  /** Soft note above the buttons, e.g. the rename notice. */
  notice?: string
  /** Resolves when the change is saved; rejects with a message to show in the dialog. */
  onSubmit: (values: ReferenceFormValues) => Promise<void>
}

/**
 * Create or rename dialog shared by the reference lists. It keeps the dialog open on failure and shows the
 * message inline. Mount it with a `key` per opening so the fields start from the current values.
 */
export function ReferenceFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  nameLabel,
  namePlaceholder,
  initialName,
  maxLength,
  network,
  nameLockedReason,
  notice,
  onSubmit,
}: ReferenceFormDialogProps) {
  const nameId = useId()
  const networkId = useId()
  const errorId = useId()
  const [name, setName] = useState(initialName)
  const [networkType, setNetworkType] = useState<NetworkType>(network?.initial ?? "BT")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const cleaned = cleanLabel(name)
    const problem = validateReferenceName(cleaned, maxLength)
    if (problem) {
      setError(problem)
      return
    }

    setError(null)
    setBusy(true)
    try {
      await onSubmit({ name: cleaned, networkType: network ? networkType : undefined })
      onOpenChange(false)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={nameId}>{nameLabel}</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError(null)
              }}
              placeholder={namePlaceholder}
              disabled={busy || nameLockedReason !== undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoFocus
            />
            {nameLockedReason ? <p className="text-xs text-muted-foreground">{nameLockedReason}</p> : null}
          </div>

          {network ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={networkId}>Réseau</Label>
              <Select
                value={networkType}
                onValueChange={(value) => setNetworkType(value === "MT" ? "MT" : "BT")}
                disabled={busy || network.lockedReason !== undefined}
              >
                <SelectTrigger id={networkId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-soft-lg">
                  <SelectItem value="BT">BT · Basse tension</SelectItem>
                  <SelectItem value="MT">MT · Moyenne tension</SelectItem>
                </SelectContent>
              </Select>
              {network.lockedReason ? <p className="text-xs text-muted-foreground">{network.lockedReason}</p> : null}
            </div>
          ) : null}

          {notice ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{notice}</p> : null}

          {error ? (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Enregistrement…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
