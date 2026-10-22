import { TIME_CONTROLS, type ColorPreference, type TimeControlId } from "@glichess/shared"
import { Link2 } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useConnectionStatus } from "@/hooks/use-connection"
import { ackError, socket } from "@/lib/socket"
import { cn } from "@/lib/utils"

const colors: { value: ColorPreference; label: string }[] = [
  { value: "white", label: "White" },
  { value: "random", label: "Random" },
  { value: "black", label: "Black" },
]

export function PlayFriendDialog() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [timeControlId, setTimeControlId] = useState<TimeControlId>("5+0")
  const [color, setColor] = useState<ColorPreference>("random")
  const [creating, setCreating] = useState(false)
  const ready = useConnectionStatus() === "connected"

  const create = () => {
    setCreating(true)
    socket.timeout(10_000).emit("game:create", { timeControlId, color }, (err, res) => {
      setCreating(false)
      const error = ackError(err, res)
      if (error || !res.ok) {
        toast.error(error)
        return
      }
      setOpen(false)
      void navigate(`/game/${res.data.gameId}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!ready}>
          <Link2 />
          Play a friend
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Play a friend</DialogTitle>
          <DialogDescription>
            Create a game and share the link. Video is on by default.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="label-mono">Time control</legend>
          <div className="grid grid-cols-5 gap-2 pt-2">
            {TIME_CONTROLS.map((tc) => (
              <Choice
                key={tc.id}
                selected={tc.id === timeControlId}
                onClick={() => setTimeControlId(tc.id)}
              >
                {tc.id}
              </Choice>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="label-mono">Your side</legend>
          <div className="grid grid-cols-3 gap-2 pt-2">
            {colors.map((c) => (
              <Choice key={c.value} selected={c.value === color} onClick={() => setColor(c.value)}>
                {c.label}
              </Choice>
            ))}
          </div>
        </fieldset>

        <DialogFooter>
          <Button onClick={create} disabled={creating || !ready} className="w-full sm:w-auto">
            {creating ? "Creating…" : "Create game"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "h-10 rounded-md border font-mono text-sm transition-colors",
        selected
          ? "border-foreground bg-foreground text-background"
          : "bg-background hover:bg-accent",
      )}
    >
      {children}
    </button>
  )
}
