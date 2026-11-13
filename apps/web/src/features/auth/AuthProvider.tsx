import type { Session } from "@supabase/supabase-js"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { supabase } from "@/lib/supabase"

import { AuthContext, type AuthContextValue, type AuthStatus, type CurrentUser } from "./auth-context"
import { mapAuthError } from "./auth-errors"
import { loadAuthorizedUser } from "./profile"

/** Listens to the Supabase session and exposes the authorized dashboard user. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)
  // Guards against out-of-order profile responses when several auth events fire.
  const requestIdRef = useRef(0)

  // Id of the user whose profile check already passed. Supabase re-emits SIGNED_IN when the tab
  // regains focus; re-checking the same user would flash the loader and remount every page.
  const authorizedUserIdRef = useRef<string | null>(null)

  const resolveSession = useCallback(async (next: Session | null) => {
    setSession(next)

    if (next && next.user.id === authorizedUserIdRef.current) return

    const requestId = ++requestIdRef.current

    if (!next) {
      authorizedUserIdRef.current = null
      setUser(null)
      setStatus("signed-out")
      return
    }

    setStatus("checking")
    const result = await loadAuthorizedUser(next.user.id)
    if (requestId !== requestIdRef.current) return

    if (result.ok) {
      authorizedUserIdRef.current = next.user.id
      setUser(result.user)
      setAccessError(null)
      setStatus("authorized")
      return
    }

    // Not allowed: drop the session and explain why on the login page.
    setUser(null)
    setSession(null)
    setAccessError(result.message)
    setStatus("signed-out")
    await supabase.auth.signOut()
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      void resolveSession(data.session)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      // Token refreshes do not change who is signed in; skip the profile check.
      if (event === "TOKEN_REFRESHED") {
        setSession(next)
        return
      }
      // Never query Supabase inside this callback: it runs under the auth lock and a query here
      // waits on that same lock (documented supabase-js deadlock). Defer until the callback returns.
      setTimeout(() => {
        void resolveSession(next)
      }, 0)
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [resolveSession])

  const signIn = useCallback(async (email: string, password: string) => {
    setAccessError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      return { error: mapAuthError(error.message) }
    }
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    setAccessError(null)
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, user, accessError, signIn, signOut }),
    [status, session, user, accessError, signIn, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
