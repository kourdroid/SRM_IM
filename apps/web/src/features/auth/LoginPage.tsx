import { LoaderCircle } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Navigate, useLocation } from "react-router"

import { BrandMark } from "@/components/shared/BrandMark"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useAuth } from "./auth-context"

type LocationState = { from?: string } | null

/** Email and password sign-in for the supervision dashboard (French copy). */
export function LoginPage() {
  const { status, signIn, accessError } = useAuth()
  const location = useLocation()
  const redirectTo = (location.state as LocationState)?.from ?? "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (status === "authorized") {
    return <Navigate to={redirectTo} replace />
  }

  const busy = submitting || status === "checking"
  const message = formError ?? (status === "signed-out" ? accessError : null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSubmitting(true)
    const result = await signIn(email, password)
    setSubmitting(false)
    if (result.error) {
      setFormError(result.error)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <BrandMark />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Connexion</CardTitle>
            <CardDescription>Supervision SRM-CS · Province Sidi Bennour</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-email">Adresse e-mail</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="login-password">Mot de passe</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
              </div>

              {message ? (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {message}
                </p>
              ) : null}

              <Button type="submit" size="lg" className="mt-2 w-full" disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                {busy ? "Connexion en cours…" : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
