import type { FormEvent, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * Shared frame for the incident action dialogs: title, optional description, body, inline error and a
 * cancel / submit footer. The body is a native form, so Enter submits. Closing is blocked while `pending`.
 */
export function ActionDialog({
  title,
  description,
  submitLabel,
  pending = false,
  submitDisabled = false,
  destructive = false,
  error = null,
  onOpenChange,
  onSubmit,
  children,
}: {
  title: string
  description?: string
  submitLabel: string
  pending?: boolean
  submitDisabled?: boolean
  destructive?: boolean
  error?: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
  children: ReactNode
}) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (!pending && !submitDisabled) onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          {children}

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending || submitDisabled}>
              {pending ? "Patientez…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Frame shown while a dialog's reference data or materials load, or when that load fails. */
export function ActionDialogPlaceholder({
  title,
  submitLabel,
  message,
  onOpenChange,
}: {
  title: string
  submitLabel: string
  message: string
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ActionDialog title={title} submitLabel={submitLabel} submitDisabled onOpenChange={onOpenChange} onSubmit={() => undefined}>
      <p className="text-sm text-muted-foreground">{message}</p>
    </ActionDialog>
  )
}
