import { isGameOver, otherColor, type Color, type GameSnapshot } from "@glichess/shared"
import { ArrowUpDown, Flag, Handshake, RotateCcw, X } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import type { useGame } from "@/hooks/use-game"

type Actions = ReturnType<typeof useGame>["actions"]

export function GameActions({
  snapshot,
  myColor,
  actions,
  onFlip,
}: {
  snapshot: GameSnapshot
  myColor: Color | null
  actions: Actions
  onFlip: () => void
}) {
  const [confirmResign, setConfirmResign] = useState(false)
  const flip = (
    <Button variant="outline" size="sm" onClick={onFlip} className="col-span-2">
      <ArrowUpDown />
      Flip board
    </Button>
  )

  if (!myColor) return <div className="grid grid-cols-2 gap-2">{flip}</div>

  if (isGameOver(snapshot.status)) {
    const theyOffered = snapshot.rematchOfferBy === otherColor(myColor)
    const iOffered = snapshot.rematchOfferBy === myColor
    return (
      <div className="grid grid-cols-2 gap-2">
        {theyOffered ? (
          <>
            <Button size="sm" onClick={() => actions.rematch("offer")}>
              <RotateCcw />
              Accept rematch
            </Button>
            <Button size="sm" variant="outline" onClick={() => actions.rematch("decline")}>
              Decline
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="col-span-2"
            disabled={iOffered || !snapshot.white || !snapshot.black}
            onClick={() => actions.rematch("offer")}
          >
            <RotateCcw />
            {iOffered ? "Rematch offered…" : "Rematch"}
          </Button>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link to="/">New game</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={onFlip}>
          <ArrowUpDown />
          Flip
        </Button>
      </div>
    )
  }

  if (snapshot.status === "waiting") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="col-span-2" onClick={actions.abort}>
          <X />
          Cancel invite
        </Button>
      </div>
    )
  }

  const canAbort = snapshot.moves.length < 2
  const theyOfferDraw = snapshot.drawOfferBy === otherColor(myColor)
  const iOfferDraw = snapshot.drawOfferBy === myColor

  return (
    <div className="grid grid-cols-2 gap-2">
      {theyOfferDraw && (
        <div className="col-span-2 flex items-center justify-between gap-2 rounded-md border border-signal/40 bg-signal/10 px-3 py-2 text-sm">
          <span>Draw offered</span>
          <div className="flex gap-1.5">
            <Button size="xs" onClick={() => actions.draw("accept")}>
              Accept
            </Button>
            <Button size="xs" variant="outline" onClick={() => actions.draw("decline")}>
              Decline
            </Button>
          </div>
        </div>
      )}
      {canAbort ? (
        <Button variant="outline" size="sm" className="col-span-2" onClick={actions.abort}>
          <X />
          Abort
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={iOfferDraw || theyOfferDraw}
            onClick={() => actions.draw("offer")}
          >
            <Handshake />
            {iOfferDraw ? "Offered" : "Offer draw"}
          </Button>
          <Button
            variant={confirmResign ? "destructive" : "outline"}
            size="sm"
            className={confirmResign ? undefined : "text-destructive"}
            onClick={() => {
              if (confirmResign) actions.resign()
              setConfirmResign(!confirmResign)
            }}
            onBlur={() => setConfirmResign(false)}
          >
            <Flag />
            {confirmResign ? "Confirm" : "Resign"}
          </Button>
        </>
      )}
      {flip}
    </div>
  )
}
