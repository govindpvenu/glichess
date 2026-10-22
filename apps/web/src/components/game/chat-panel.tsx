import { CHAT_MAX_LENGTH, type Color, type GameSnapshot } from "@glichess/shared"
import { SendHorizontal } from "lucide-react"
import { useLayoutEffect, useRef, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { useChat, type ChatEntry } from "@/hooks/use-chat"
import { useConnectionStatus } from "@/hooks/use-connection"
import { cn } from "@/lib/utils"

const QUICK_MESSAGES = ["Hi!", "Good luck", "Have fun", "Good game", "Well played", "Thanks"]

/** Consecutive messages from one player within this window share a single header. */
const GROUP_WINDOW_MS = 2 * 60_000
/** Show the remaining characters once the draft gets this close to the limit. */
const COUNTER_THRESHOLD = 40

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" })

export function ChatPanel({
  snapshot,
  myColor,
}: {
  snapshot: GameSnapshot
  /** Null for spectators: the chat is private to the players. */
  myColor: Color | null
}) {
  const { messages, send } = useChat(snapshot.id, myColor !== null)

  if (!myColor) {
    return (
      <Notice>
        {snapshot.status === "waiting"
          ? "Chat opens when your opponent joins."
          : "Chat is private to the players."}
      </Notice>
    )
  }

  const colorOf = (userId: string | null): Color | null =>
    userId === snapshot.white?.id ? "white" : userId === snapshot.black?.id ? "black" : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageList messages={messages} snapshot={snapshot} colorOf={colorOf} />
      <Composer onSend={send} />
    </div>
  )
}

function MessageList({
  messages,
  snapshot,
  colorOf,
}: {
  messages: ChatEntry[]
  snapshot: GameSnapshot
  colorOf: (userId: string | null) => Color | null
}) {
  const listRef = useRef<HTMLOListElement>(null)
  /** Whether the reader is at the bottom; new messages only scroll the list if so. */
  const pinned = useRef(true)
  const last = messages.at(-1)

  useLayoutEffect(() => {
    const list = listRef.current
    // Your own message always comes into view, even if you had scrolled up.
    if (list && (pinned.current || last?.pending)) list.scrollTop = list.scrollHeight
  }, [last])

  if (messages.length === 0) return <Notice>No messages yet. Say hello.</Notice>

  return (
    <ol
      ref={listRef}
      aria-label="Chat messages"
      aria-live="polite"
      onScroll={(e) => {
        const list = e.currentTarget
        pinned.current = list.scrollHeight - list.scrollTop - list.clientHeight < 24
      }}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
    >
      {messages.map((message, i) => {
        const previous = messages[i - 1]
        const grouped =
          previous?.userId === message.userId &&
          message.createdAt - previous.createdAt < GROUP_WINDOW_MS
        const color = colorOf(message.userId)
        // Prefer the player's current name: a guest who signs in keeps their messages.
        const name = (color && snapshot[color]?.name) ?? message.name

        return (
          <li
            key={message.id}
            className={cn(i > 0 && (grouped ? "mt-1" : "mt-3"), message.pending && "opacity-50")}
          >
            {!grouped && (
              <div className="mb-1 flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-[2px] border border-foreground/30",
                    color === "white" ? "bg-white" : "bg-black",
                  )}
                />
                <span className="truncate text-xs font-medium">{name}</span>
                <time
                  dateTime={new Date(message.createdAt).toISOString()}
                  className="ml-auto label-mono"
                >
                  {timeFormat.format(message.createdAt)}
                </time>
              </div>
            )}
            <p className="pl-4 text-sm leading-snug [overflow-wrap:anywhere]">{message.body}</p>
          </li>
        )
      })}
    </ol>
  )
}

function Composer({ onSend }: { onSend: (body: string) => Promise<boolean> }) {
  const connected = useConnectionStatus() === "connected"
  const [draft, setDraft] = useState("")
  const body = draft.trim()
  const remaining = CHAT_MAX_LENGTH - draft.length

  const submit = (text: string) => {
    if (!text || !connected) return
    setDraft("")
    void onSend(text).then((ok) => {
      // Give the text back if it didn't go through and nothing new was typed.
      if (!ok) setDraft((current) => current || text)
    })
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit(body)
  }

  return (
    <div className="border-t">
      <div className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_right,black_85%,transparent)] px-3 pt-2.5">
        {QUICK_MESSAGES.map((text) => (
          <button
            key={text}
            type="button"
            disabled={!connected}
            onClick={() => submit(text)}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap text-muted-foreground transition-colors",
              "hover:bg-accent hover:text-foreground disabled:opacity-50",
              "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            )}
          >
            {text}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="flex items-center gap-1 p-2 pl-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Send a message"
          aria-label="Message"
          autoComplete="off"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {remaining <= COUNTER_THRESHOLD && (
          <span className={cn("label-mono", remaining <= 10 && "text-destructive")}>
            {remaining}
          </span>
        )}
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          disabled={!body || !connected}
          aria-label="Send message"
        >
          <SendHorizontal />
        </Button>
      </form>
    </div>
  )
}

function Notice({ children }: { children: string }) {
  return (
    <p className="flex h-full min-h-0 flex-1 items-center justify-center px-6 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}
