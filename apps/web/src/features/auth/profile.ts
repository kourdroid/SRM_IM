import { supabase } from "@/lib/supabase"

import type { CurrentUser } from "./auth-context"
import { isRole } from "./roles"

export const ACCESS_DENIED_MESSAGE = "Accès réservé aux administrateurs et directeurs."
const PROFILE_ERROR_MESSAGE = "Impossible de vérifier votre profil. Réessayez."

type ProfileRow = {
  id: string
  name: string | null
  role: string | null
  approval_status: string | null
}

export type ProfileResult = { ok: true; user: CurrentUser } | { ok: false; message: string }

/** Loads the user_profiles row and allows only approved admins and directors. */
export async function loadAuthorizedUser(userId: string): Promise<ProfileResult> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, name, role, approval_status")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    return { ok: false, message: PROFILE_ERROR_MESSAGE }
  }

  const row = data as ProfileRow | null
  if (!row || row.approval_status !== "approved" || !isRole(row.role)) {
    return { ok: false, message: ACCESS_DENIED_MESSAGE }
  }

  return {
    ok: true,
    user: {
      id: row.id,
      name: row.name?.trim() || "Utilisateur",
      role: row.role,
    },
  }
}
