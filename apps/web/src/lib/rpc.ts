import type { PostgrestError } from "@supabase/supabase-js"

/**
 * Turns a Supabase error into a sentence an administrator can act on. Server functions already raise
 * French messages for validation problems; technical codes are translated here.
 */
export function describeError(error: unknown, fallback = "L'opération a échoué. Réessayez."): string {
  const candidate = error as Partial<PostgrestError> & { message?: string }
  const code = candidate?.code
  const message = typeof candidate?.message === "string" ? candidate.message : ""

  if (code === "42501" || /permission denied|not authorized|unauthorized|admin required/i.test(message)) {
    return "Action réservée aux administrateurs."
  }
  if (code === "23505") return "Cet élément existe déjà."
  if (code === "23503") return "Cet élément est encore utilisé et ne peut pas être supprimé."
  if (/Failed to fetch|NetworkError|timeout/i.test(message)) {
    return "Connexion impossible. Vérifiez internet puis réessayez."
  }
  return message.trim() || fallback
}

/** Throws an Error carrying a readable message when a Supabase call failed. */
export function throwIfError(error: unknown, fallback?: string): void {
  if (error) throw new Error(describeError(error, fallback))
}
