import type { PublicUser } from "@glichess/shared"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { SessionContext, type SessionContextValue } from "@/lib/session"
import { reconnectSocket, socket } from "@/lib/socket"

/**
 * Guarantees every visitor has a session: signs in as a guest when there is none,
 * and (re)connects the socket whenever the signed-in user changes.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { data, isPending, error, refetch } = authClient.useSession()
  const [guestError, setGuestError] = useState(false)
  const creatingGuest = useRef(false)

  const needsGuest = !isPending && !data && !error && !guestError

  useEffect(() => {
    if (!needsGuest || creatingGuest.current) return
    creatingGuest.current = true
    void authClient.signIn
      .anonymous()
      .then((res) => {
        if (res.error) setGuestError(true)
      })
      .finally(() => {
        creatingGuest.current = false
      })
  }, [needsGuest])

  const userId = data?.user.id
  useEffect(() => {
    if (!userId) return
    // A new user needs a fresh handshake so the server reads the new session cookie.
    reconnectSocket()
    return () => {
      socket.disconnect()
    }
  }, [userId])

  useEffect(() => {
    const onConnectError = (err: Error) => {
      if (err.message === "UNAUTHORIZED") void refetch()
    }
    socket.on("connect_error", onConnectError)
    return () => {
      socket.off("connect_error", onConnectError)
    }
  }, [refetch])

  useOAuthErrorToast()

  const user = useMemo<PublicUser | null>(
    () =>
      data
        ? {
            id: data.user.id,
            name: data.user.name,
            image: data.user.image ?? null,
            isGuest: data.user.isAnonymous ?? false,
          }
        : null,
    [data],
  )

  const retry = useCallback(() => {
    setGuestError(false)
    void refetch()
  }, [refetch])

  const value = useMemo<SessionContextValue>(
    () => ({
      status: user ? "ready" : error || guestError ? "error" : "loading",
      user,
      retry,
      signInWithGoogle: async () => {
        const res = await authClient.signIn.social({
          provider: "google",
          callbackURL: window.location.pathname,
          errorCallbackURL: "/?auth_error=google",
        })
        if (res.error) toast.error("Couldn't start Google sign-in. Please try again.")
      },
      signOut: async () => {
        const res = await authClient.signOut()
        if (res.error) toast.error("Couldn't sign out. Please try again.")
        else toast("Signed out. You're playing as a guest now.")
      },
    }),
    [user, error, guestError, retry],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}

/** Better Auth redirects to `errorCallbackURL` when the OAuth flow fails. */
function useOAuthErrorToast() {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has("auth_error")) return
    toast.error("Google sign-in didn't complete. Please try again.")
    url.searchParams.delete("auth_error")
    url.searchParams.delete("error")
    window.history.replaceState(null, "", url)
  }, [])
}
