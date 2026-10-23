import { useEffect, useState } from "react"

import { audioContext } from "@/lib/audio"

/** RMS level (0–1) above which a voice counts as speaking. */
const THRESHOLD = 0.02
/** Keeps the indicator on through the short pauses between words. */
const HOLD_MS = 350
const SAMPLE_MS = 100

/** Whether there is voice on an audio track right now. Pass null when the track is off. */
export function useSpeaking(track: MediaStreamTrack | null) {
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!track) return
    const ctx = audioContext()
    const source = ctx.createMediaStreamSource(new MediaStream([track]))
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    let lastVoice = 0

    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) sum += sample * sample
      const now = performance.now()
      if (Math.sqrt(sum / samples.length) > THRESHOLD) lastVoice = now
      setSpeaking(now - lastVoice < HOLD_MS)
    }, SAMPLE_MS)

    return () => {
      clearInterval(timer)
      source.disconnect()
    }
  }, [track])

  return track !== null && speaking
}
