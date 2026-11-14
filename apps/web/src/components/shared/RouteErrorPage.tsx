import { useState } from "react"
import { isRouteErrorResponse, Link, useRouteError } from "react-router"

import { Button } from "@/components/ui/button"
import { isStaleBuildError, reloadForNewVersion } from "@/lib/staleBuild"

/** Route-level error boundary: explains the failure in French and offers a way back. */
export function RouteErrorPage() {
  const error = useRouteError()
  // A page file from the previous deploy is gone: reload once to get the new version instead of
  // showing an error the user has to clear by hand.
  const [reloading] = useState(() => isStaleBuildError(error) && reloadForNewVersion())
  if (reloading) return null
  const notFound = isRouteErrorResponse(error) && error.status === 404
  const title = notFound ? "Page introuvable" : "Une erreur est survenue"
  const description = notFound
    ? "Cette page n'existe pas ou a été déplacée."
    : "Rechargez la page. Si le problème persiste, contactez l'équipe technique."

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Recharger
        </Button>
        <Button asChild>
          <Link to="/">Retour à l'accueil</Link>
        </Button>
      </div>
    </main>
  )
}
