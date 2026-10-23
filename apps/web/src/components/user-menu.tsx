import { ChevronDown, LogOut, RotateCw } from "lucide-react"
import { useState } from "react"

import { GoogleIcon } from "@/components/google-icon"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { UserAvatar } from "@/components/user-avatar"
import { useSession } from "@/lib/session"

export function UserMenu() {
  const { status, user, retry, signInWithGoogle, signOut } = useSession()
  const [redirecting, setRedirecting] = useState(false)

  if (status === "error") {
    return (
      <Button variant="outline" size="sm" onClick={retry}>
        <RotateCw />
        Retry
      </Button>
    )
  }

  if (!user) return <Skeleton className="h-8 w-32" />

  const startGoogleSignIn = () => {
    setRedirecting(true)
    // On success the browser leaves the page, so only reset when the redirect didn't start.
    void signInWithGoogle().finally(() => setRedirecting(false))
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 px-1 md:pr-2"
            aria-label="Account menu"
          >
            <UserAvatar user={user} size="sm" />
            <span className="hidden max-w-32 truncate md:inline">{user.name}</span>
            <ChevronDown className="hidden text-muted-foreground md:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-3 py-2">
            <UserAvatar user={user} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="mt-1 label-mono">{user.isGuest ? "Guest" : "Google account"}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {user.isGuest ? (
            <>
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Sign in to keep your games and play rated. Your guest games come with you.
              </p>
              <DropdownMenuItem disabled={redirecting} onSelect={startGoogleSignIn}>
                <GoogleIcon />
                Sign in with Google
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {user.isGuest && (
        <Button size="sm" disabled={redirecting} onClick={startGoogleSignIn}>
          <GoogleIcon />
          <span className="hidden sm:inline">Sign in with Google</span>
          {/* The smallest phones get just the Google mark, so the header fits on one line. */}
          <span className="max-[25rem]:sr-only sm:hidden">Sign in</span>
        </Button>
      )}
    </div>
  )
}
