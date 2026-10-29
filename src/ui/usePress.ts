import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_VISIBLE_MS = 120 // --toque-minimo

/** Mantiene el apretón visible al menos 120 ms aunque el toque sea más corto. */
export function usePress() {
  const [pressed, setPressed] = useState(false)
  const since = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const down = useCallback(() => {
    clearTimeout(timer.current)
    since.current = Date.now()
    setPressed(true)
  }, [])

  const up = useCallback(() => {
    const left = MIN_VISIBLE_MS - (Date.now() - since.current)
    clearTimeout(timer.current)
    if (left <= 0) setPressed(false)
    else timer.current = setTimeout(() => setPressed(false), left)
  }, [])

  return {
    pressed,
    handlers: { onPointerDown: down, onPointerUp: up, onPointerLeave: up, onPointerCancel: up },
  }
}
