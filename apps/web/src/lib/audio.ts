let context: AudioContext | null = null

/**
 * The page's one AudioContext, shared by the speaking indicator and the game sounds. Browsers
 * start it suspended until the page receives a click or key press, and some (iOS Safari)
 * suspend it again in the background, so every interaction resumes it if needed.
 */
export function audioContext() {
  if (!context) {
    const ctx = new AudioContext()
    context = ctx
    const resume = () => {
      if (ctx.state !== "running") void ctx.resume()
    }
    document.addEventListener("pointerdown", resume)
    document.addEventListener("keydown", resume)
  }
  return context
}
