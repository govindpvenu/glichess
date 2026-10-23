import { Volume2, VolumeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { setSoundEnabled, useSoundEnabled } from "@/lib/sound"

export function SoundToggle() {
  const enabled = useSoundEnabled()
  const label = enabled ? "Turn sounds off" : "Turn sounds on"

  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={() => setSoundEnabled(!enabled)}
      className={enabled ? undefined : "text-muted-foreground"}
    >
      {enabled ? <Volume2 /> : <VolumeOff />}
    </Button>
  )
}
