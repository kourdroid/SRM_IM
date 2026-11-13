import type { Session } from "@supabase/supabase-js"
import { createContext, useContext } from "react"

import type { Role } from "./roles"

/** The signed-in dashboard user, as read from user_profiles. */
export type CurrentUser = {
  id: string
  name: string
  role: Role
}

/** loading: restoring session; checking: verifying profile; authorized: may use the app. */
export type AuthStatus = "loading" | "checking" | "signed-out" | "authorized"

export type SignInResult = { error: string | null }

export type AuthContextValue = {
  status: AuthStatus
  session: Session | null
  user: CurrentUser | null
  /** French message explaining why the last sign-in was refused, if any. */
  accessError: string | null
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** Reads the auth state; must be used inside AuthProvider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>.")
  }
  return context
}
