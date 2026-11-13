/** Maps Supabase auth error messages to French copy for the login form. */
export function mapAuthError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou mot de passe incorrect."
  }
  if (normalized.includes("email not confirmed")) {
    return "Votre adresse e-mail n'est pas encore confirmée."
  }
  if (normalized.includes("too many requests") || normalized.includes("rate limit")) {
    return "Trop de tentatives. Réessayez dans quelques minutes."
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network")) {
    return "Connexion impossible. Vérifiez votre réseau."
  }
  return "Connexion impossible. Réessayez."
}
