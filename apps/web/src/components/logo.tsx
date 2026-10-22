import { Link } from "react-router"
import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        "flex items-center gap-2.5 font-mono text-[17px] font-semibold tracking-tight",
        className,
      )}
    >
      <span aria-hidden className="relative size-3.5 bg-signal">
        <span className="absolute -right-1.5 -bottom-1.5 size-1.5 bg-foreground" />
      </span>
      glichess
    </Link>
  )
}
