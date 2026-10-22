import type { PublicUser } from "@glichess/shared"
import { createContext, useContext } from "react"

export type SessionStatus = "loading" | "ready" | "error"

export interface SessionContextValue {
  status: SessionStatus
  /** Null until a session (guest or Google) exists. */
  user: PublicUser | null
  retry: () => void
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>")
  return ctx
}
