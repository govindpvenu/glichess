import { Check, Copy } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

export function InvitePanel({ gameId }: { gameId: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/game/${gameId}`

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Send this link to a friend. The game starts as soon as they open it.
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          aria-label="Invite link"
          onFocus={(e) => e.currentTarget.select()}
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2.5 font-mono text-xs"
        />
        <Button size="sm" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  )
}
