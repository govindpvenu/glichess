import { Link } from "react-router"

import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="glichess home"
      className={cn(
        "shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4",
        className,
      )}
    >
      <img
        src="/brand/logo-light.svg"
        alt="glichess"
        width={1161}
        height={353}
        className="h-8 w-auto dark:hidden"
      />
      <img
        src="/brand/logo-dark.svg"
        alt="glichess"
        width={1161}
        height={353}
        className="hidden h-8 w-auto dark:block"
      />
    </Link>
  )
}
