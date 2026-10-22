import type { Color } from "@glichess/shared"
import { Chess, type Move, type Square } from "chess.js"
import { useMemo, useState, type CSSProperties } from "react"
import { Chessboard, defaultPieces, type PieceDropHandlerArgs } from "react-chessboard"

import { cn } from "@/lib/utils"

const isSquare = (value: string | null): value is Square => !!value && /^[a-h][1-8]$/.test(value)

const PROMOTION_PIECES = ["q", "r", "b", "n"] as const
type PromotionPiece = (typeof PROMOTION_PIECES)[number]

const highlight: CSSProperties = { background: "var(--board-highlight)" }
const moveDot: CSSProperties = {
  background: "radial-gradient(circle, rgb(0 0 0 / 0.22) 22%, transparent 24%)",
}
const captureRing: CSSProperties = {
  background: "radial-gradient(circle, transparent 58%, rgb(0 0 0 / 0.22) 60%)",
}
const checkGlow: CSSProperties = {
  background: "radial-gradient(circle, rgb(229 72 77 / 0.85) 0%, rgb(229 72 77 / 0) 70%)",
}
const notation: CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }

interface GameBoardProps {
  fen: string
  orientation: Color
  /** The side the viewer may move, or null for spectators and finished games. */
  playerColor: Color | null
  lastMove: string | null
  onMove: (uci: string) => void
}

export function GameBoard({ fen, orientation, playerColor, lastMove, onMove }: GameBoardProps) {
  const chess = useMemo(() => new Chess(fen), [fen])
  const myTurn = playerColor !== null && chess.turn() === playerColor[0]
  // Keyed by position so a new position clears any selection or pending promotion.
  const [selection, setSelection] = useState<{ fen: string; square: Square } | null>(null)
  const [promotion, setPromotion] = useState<{ fen: string; from: Square; to: Square } | null>(null)
  const selected = selection?.fen === fen ? selection.square : null
  const pendingPromotion = promotion?.fen === fen ? promotion : null

  const targets = useMemo<Move[]>(
    () => (selected ? chess.moves({ square: selected, verbose: true }) : []),
    [chess, selected],
  )

  const ownsPiece = (square: Square) => {
    const piece = chess.get(square)
    return !!piece && !!playerColor && piece.color === playerColor[0]
  }

  /** Plays from→to if legal; asks for a piece first when it's a promotion. */
  const tryMove = (from: Square, to: Square) => {
    if (!myTurn) return false
    const legal = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to)
    if (legal.length === 0) return false
    setSelection(null)
    if (legal.some((m) => m.promotion)) {
      setPromotion({ fen, from, to })
      return false
    }
    onMove(`${from}${to}`)
    return true
  }

  const onPieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) =>
    isSquare(sourceSquare) && isSquare(targetSquare) && tryMove(sourceSquare, targetSquare)

  const onSquareClick = ({ square: sq }: { square: string }) => {
    if (!isSquare(sq)) return
    if (selected && targets.some((m) => m.to === sq)) {
      tryMove(selected, sq)
      return
    }
    setSelection(ownsPiece(sq) && sq !== selected ? { fen, square: sq } : null)
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {}
    if (lastMove) {
      styles[lastMove.slice(0, 2)] = highlight
      styles[lastMove.slice(2, 4)] = highlight
    }
    if (chess.inCheck()) {
      const king = chess
        .board()
        .flat()
        .find((p) => p?.type === "k" && p.color === chess.turn())
      if (king) styles[king.square] = checkGlow
    }
    if (selected) styles[selected] = highlight
    for (const move of targets) {
      styles[move.to] = { ...styles[move.to], ...(move.captured ? captureRing : moveDot) }
    }
    return styles
  }, [chess, lastMove, selected, targets])

  return (
    <div className="relative aspect-square w-full select-none">
      <Chessboard
        options={{
          id: "game-board",
          position: fen,
          boardOrientation: orientation,
          allowDragging: myTurn,
          canDragPiece: ({ piece }) => myTurn && piece.pieceType[0] === playerColor?.[0],
          onPieceDrop,
          onSquareClick,
          onPieceDrag: ({ square }) => {
            if (isSquare(square) && ownsPiece(square)) setSelection({ fen, square })
          },
          squareStyles,
          boardStyle: { borderRadius: 6, overflow: "hidden" },
          lightSquareStyle: { backgroundColor: "var(--board-light)" },
          darkSquareStyle: { backgroundColor: "var(--board-dark)" },
          lightSquareNotationStyle: { ...notation, color: "var(--board-dark)" },
          darkSquareNotationStyle: { ...notation, color: "var(--board-light)" },
          dropSquareStyle: { boxShadow: "inset 0 0 0 3px var(--board-highlight)" },
          animationDurationInMs: 150,
        }}
      />

      {pendingPromotion && playerColor && (
        <PromotionPicker
          color={playerColor}
          onPick={(piece) => {
            setPromotion(null)
            onMove(`${pendingPromotion.from}${pendingPromotion.to}${piece}`)
          }}
          onCancel={() => setPromotion(null)}
        />
      )}
    </div>
  )
}

function PromotionPicker({
  color,
  onPick,
  onCancel,
}: {
  color: Color
  onPick: (piece: PromotionPiece) => void
  onCancel: () => void
}) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center rounded-md bg-black/40">
      <dialog
        open
        aria-label="Choose a piece to promote to"
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        className="static flex flex-col items-center gap-2 rounded-lg border bg-popover p-2 text-popover-foreground"
      >
        <div className="flex gap-1">
          {PROMOTION_PIECES.map((piece) => {
            const render = defaultPieces[`${color[0]}${piece.toUpperCase()}`]
            return (
              <button
                key={piece}
                type="button"
                aria-label={`Promote to ${pieceName[piece]}`}
                onClick={() => onPick(piece)}
                className={cn(
                  "size-16 rounded-md p-1 transition-colors hover:bg-accent",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                )}
              >
                {render?.()}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-1 label-mono hover:text-foreground"
        >
          Cancel
        </button>
      </dialog>
    </div>
  )
}

const pieceName: Record<PromotionPiece, string> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
}
