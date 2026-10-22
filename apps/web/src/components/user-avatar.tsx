import type { PublicUser } from "@glichess/shared"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function UserAvatar({
  user,
  size = "default",
  className,
}: {
  user: PublicUser
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  return (
    <Avatar size={size} className={cn("rounded-md", className)}>
      {user.image && <AvatarImage src={user.image} alt="" className="rounded-md" />}
      <AvatarFallback className="rounded-md border bg-secondary font-mono text-xs font-medium text-foreground">
        {user.name.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}
