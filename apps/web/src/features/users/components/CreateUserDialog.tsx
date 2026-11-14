import { Eye, EyeOff } from "lucide-react"
import { useId, useState, type FormEvent, type ReactNode } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MIN_PASSWORD_LENGTH, useCreateUser, type UserRole } from "@/data/users"
import { describeError } from "@/lib/rpc"

import { ROLE_LABELS, ROLE_OPTIONS, toUserRole } from "../user-utils"

type FormState = {
  name: string
  email: string
  password: string
  role: UserRole
}

type FormErrors = Partial<Record<keyof FormState, string>>

const EMPTY_FORM: FormState = { name: "", email: "", password: "", role: "field" }
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Field-level messages in French. The password is never logged or echoed in a message. */
function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.name.trim()) errors.name = "Le nom est requis."
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Saisissez une adresse e-mail valide."
  if (form.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Le mot de passe doit comporter au moins ${MIN_PASSWORD_LENGTH} caractères.`
  }
  return errors
}

/**
 * Creates an approved account. The dialog stays open on failure so the administrator can fix the
 * values, and closing is blocked while the request is running.
 */
export function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createUser = useCreateUser()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const nameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const roleId = useId()
  const busy = createUser.isPending

  function handleOpenChange(next: boolean) {
    if (!next && busy) return
    if (!next) {
      setForm(EMPTY_FORM)
      setErrors({})
      setShowPassword(false)
    }
    onOpenChange(next)
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const name = form.name.replace(/\s+/g, " ").trim()
    try {
      await createUser.mutateAsync({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        name,
        role: form.role,
      })
      toast.success(`Compte créé et approuvé pour ${name}.`)
      handleOpenChange(false)
    } catch (error) {
      toast.error(describeError(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvel utilisateur</DialogTitle>
          <DialogDescription>Le compte est créé et approuvé immédiatement.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <FormField id={nameId} label="Nom complet" error={errors.name}>
            <Input
              id={nameId}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              autoComplete="name"
              placeholder="Ex. Ahmed Alami"
              disabled={busy}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${nameId}-error` : undefined}
              className="bg-muted"
            />
          </FormField>

          <FormField id={emailId} label="Adresse e-mail" error={errors.email}>
            <Input
              id={emailId}
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Ex. a.alami@exemple.ma"
              disabled={busy}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
              className="bg-muted"
            />
          </FormField>

          <FormField
            id={passwordId}
            label="Mot de passe provisoire"
            error={errors.password}
            hint={`Au moins ${MIN_PASSWORD_LENGTH} caractères.`}
          >
            <div className="relative">
              <Input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
                autoComplete="new-password"
                disabled={busy}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? `${passwordId}-error` : `${passwordId}-hint`}
                className="bg-muted pr-11"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                onClick={() => setShowPassword((current) => !current)}
                disabled={busy}
              >
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
          </FormField>

          <FormField id={roleId} label="Rôle">
            <Select
              value={form.role}
              onValueChange={(value) => {
                const role = toUserRole(value)
                if (role) update("role", role)
              }}
              disabled={busy}
            >
              <SelectTrigger id={roleId} className="w-full bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-soft-lg">
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Création…" : "Créer le compte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Label, control, optional hint and error. The error replaces the hint and is announced to assistive tech. */
function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
