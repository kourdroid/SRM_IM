import type { Session } from "@supabase/supabase-js"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { supabase } from "@/lib/supabase"

import { AuthContext, type AuthContextValue, type AuthStatus, type CurrentUser } from "./auth-context"
import { mapAuthError } from "./auth-errors"
import { loadAuthorizedUser, type ProfileResult } from "./profile"
import { isRole } from "./roles"

const PROFILE_CACHE_KEY = "intervx.auth.profile"

/** Returns the last authorized profile saved on this device, or null when it is missing or invalid. */
function readCachedProfile(): CurrentUser | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null

    const { id, name, role } = parsed as { id?: unknown; name?: unknown; role?: unknown }
    if (typeof id !== "string" || typeof name !== "string" || !isRole(role)) return null

    return { id, name, role }
  } catch {
    return null
  }
}

/** Saves only the id, name and role; never the session or tokens. */
function writeCachedProfile(user: CurrentUser): void {
  try {
    window.localStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify({ id: user.id, name: user.name, role: user.role })
    )
  } catch {
    // Storage can be blocked or full. The cache only speeds up reloads, so a failed write is ignored.
  }
}

function clearCachedProfile(): void {
  try {
    window.localStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

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

  // Profile request still in flight. getSession and the INITIAL_SESSION event resolve the same
  // session, so they share this request instead of querying user_profiles twice.
  const inflightProfileRef = useRef<{ userId: string; promise: Promise<ProfileResult> } | null>(null)

  const fetchProfile = useCallback((userId: string): Promise<ProfileResult> => {
    const inflight = inflightProfileRef.current
    if (inflight && inflight.userId === userId) return inflight.promise

    const promise = loadAuthorizedUser(userId)
    const entry = { userId, promise }
    inflightProfileRef.current = entry

    const clear = () => {
      if (inflightProfileRef.current === entry) inflightProfileRef.current = null
    }
    void promise.then(clear, clear)
    return promise
  }, [])

  // Failure path shared by the cold check and the background revalidation: drop the session and
  // explain why on the login page.
  const rejectSession = useCallback(async (message: string) => {
    authorizedUserIdRef.current = null
    clearCachedProfile()
    setUser(null)
    setSession(null)
    setAccessError(message)
    setStatus("signed-out")
    await supabase.auth.signOut()
  }, [])

  // Re-checks the profile in the background after the app was shown from the cache.
  const revalidateCachedUser = useCallback(
    async (userId: string, requestId: number) => {
      const result = await fetchProfile(userId)
      if (requestId !== requestIdRef.current) return

      if (!result.ok) {
        // A failed request (weak network, power cut) is not a refusal: keep the user on the cached profile
        // and let the next sign-in event or reload check again. Only a real refusal signs out.
        if (result.transient) return
        await rejectSession(result.message)
        return
      }

      const profile = result.user
      writeCachedProfile(profile)
      setUser((prev) =>
        prev && prev.id === profile.id && prev.name === profile.name && prev.role === profile.role
          ? prev
          : profile
      )
    },
    [fetchProfile, rejectSession]
  )

  const resolveSession = useCallback(
    async (next: Session | null) => {
      setSession(next)

      if (next && next.user.id === authorizedUserIdRef.current) return

      const requestId = ++requestIdRef.current

      if (!next) {
        authorizedUserIdRef.current = null
        clearCachedProfile()
        setUser(null)
        setStatus("signed-out")
        return
      }

      const userId = next.user.id
      const cached = readCachedProfile()
      if (cached && cached.id === userId) {
        // Set before any await: the INITIAL_SESSION event that follows then returns at the check above.
        authorizedUserIdRef.current = userId
        setUser(cached)
        setAccessError(null)
        setStatus("authorized")
        void revalidateCachedUser(userId, requestId)
        return
      }

      setStatus("checking")
      const result = await fetchProfile(userId)
      if (requestId !== requestIdRef.current) return

      if (result.ok) {
        authorizedUserIdRef.current = userId
        writeCachedProfile(result.user)
        setUser(result.user)
        setAccessError(null)
        setStatus("authorized")
        return
      }

      await rejectSession(result.message)
    },
    [fetchProfile, rejectSession, revalidateCachedUser]
  )

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
    clearCachedProfile()
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, user, accessError, signIn, signOut }),
    [status, session, user, accessError, signIn, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
