import { useMutation, useQuery } from "@tanstack/react-query"

import { throwIfError } from "@/lib/rpc"
import { supabase } from "@/lib/supabase"

/** Settings data: the signed-in user's password and the read-only mobile release configuration. */

export const MIN_PASSWORD_LENGTH = 8

export type AppRelease = {
  latestVersion: string
  minSupportedVersion: string
  /** Only https links are returned; anything else is treated as missing. */
  storeUrl: string | null
  message: string | null
}

type ReleaseRow = {
  latest_version: string | null
  min_supported_version: string | null
  android_store_url: string | null
  message: string | null
}

const RELEASE_COLUMNS = "latest_version, min_supported_version, android_store_url, message"

function cleanText(value: string | null | undefined): string {
  return (value ?? "").trim()
}

function safeStoreUrl(value: string | null | undefined): string | null {
  const url = cleanText(value)
  if (url.startsWith("https://")) return url
  // The phones use a market:// link (opens the Play Store app); a browser needs its web equivalent.
  const market = /^market:\/\/details\?id=([\w.]+)$/.exec(url)
  return market ? `https://play.google.com/store/apps/details?id=${market[1]}` : null
}

/** Reads the single release row; readable by every signed-in user, edited only by the developer. */
export async function fetchAppRelease(): Promise<AppRelease | null> {
  const { data, error } = await supabase.from("app_release_config").select(RELEASE_COLUMNS).maybeSingle()
  throwIfError(error, "Chargement de la configuration mobile impossible.")

  const row = data as ReleaseRow | null
  if (!row) return null

  return {
    latestVersion: cleanText(row.latest_version),
    minSupportedVersion: cleanText(row.min_supported_version),
    storeUrl: safeStoreUrl(row.android_store_url),
    message: cleanText(row.message) || null,
  }
}

export function useAppRelease() {
  return useQuery({
    queryKey: ["settings", "app-release"],
    queryFn: fetchAppRelease,
    staleTime: 5 * 60 * 1000,
  })
}

export type PasswordFieldErrors = { password?: string; confirmation?: string }

/** French checks run before calling the auth service. Returns one message per invalid field. */
export function validatePasswordChange(password: string, confirmation: string): PasswordFieldErrors {
  const errors: PasswordFieldErrors = {}
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Au moins ${MIN_PASSWORD_LENGTH} caractères.`
  }
  if (confirmation !== password) {
    errors.confirmation = "Les deux mots de passe ne correspondent pas."
  }
  return errors
}

/** Maps auth-service failures to a sentence the user can act on, without echoing the raw message. */
function describePasswordError(message: string): string {
  if (/different from the old|same as the old|should be different/i.test(message)) {
    return "Le nouveau mot de passe doit être différent de l'ancien."
  }
  if (/weak|pwned|compromised|at least|characters/i.test(message)) {
    return "Mot de passe refusé : choisissez-en un plus long ou plus varié."
  }
  if (/session|jwt|not authenticated|logged in/i.test(message)) {
    return "Session expirée. Reconnectez-vous puis réessayez."
  }
  return "Le mot de passe n'a pas pu être modifié. Réessayez."
}

/** Sets the password of the signed-in user. The password is never logged or stored by the dashboard. */
export async function changePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(describePasswordError(error.message ?? ""))
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword })
}
