import { useState, type FormEvent } from "react"
import { toast } from "sonner"

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
import {
  MIN_PASSWORD_LENGTH,
  useChangePassword,
  validatePasswordChange,
  type PasswordFieldErrors,
} from "@/data/settings"
import { describeError } from "@/lib/rpc"

/** Asks for a new password twice. The values stay in component state only and are cleared on close. */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [errors, setErrors] = useState<PasswordFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const changePassword = useChangePassword()
  const busy = changePassword.isPending

  function reset() {
    setPassword("")
    setConfirmation("")
    setErrors({})
    setFormError(null)
  }

  function handleOpenChange(next: boolean) {
    if (busy) return
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validatePasswordChange(password, confirmation)
    setErrors(nextErrors)
    setFormError(null)
    if (nextErrors.password || nextErrors.confirmation) return

    try {
      await changePassword.mutateAsync(password)
      toast.success("Mot de passe modifié.")
      reset()
      onOpenChange(false)
    } catch (error) {
      setFormError(describeError(error, "Le mot de passe n'a pas pu être modifié. Réessayez."))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Changer le mot de passe</DialogTitle>
          <DialogDescription>Au moins {MIN_PASSWORD_LENGTH} caractères.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="settings-new-password">Nouveau mot de passe</Label>
            <Input
              id="settings-new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "settings-new-password-error" : undefined}
            />
            {errors.password ? (
              <p id="settings-new-password-error" className="text-sm text-destructive">
                {errors.password}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="settings-confirm-password">Confirmer le mot de passe</Label>
            <Input
              id="settings-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={busy}
              aria-invalid={errors.confirmation ? true : undefined}
              aria-describedby={errors.confirmation ? "settings-confirm-password-error" : undefined}
            />
            {errors.confirmation ? (
              <p id="settings-confirm-password-error" className="text-sm text-destructive">
                {errors.confirmation}
              </p>
            ) : null}
          </div>

          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
