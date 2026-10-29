import { useEffect, useRef } from 'react'
import { IDENTITY_TIMEOUT_MS } from '../../domain/identity'

/** En la pared: tras el mismo plazo que vence a quien actúa, sin toques ni teclas, avisa una vez. */
export function useWallIdle(wall: boolean, onIdle: () => void): void {
  const cb = useRef(onIdle)
  useEffect(() => {
    cb.current = onIdle
  }, [onIdle])

  useEffect(() => {
    if (!wall) return
    let timer = 0
    const arm = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => cb.current(), IDENTITY_TIMEOUT_MS)
    }
    arm()
    document.addEventListener('pointerdown', arm)
    document.addEventListener('keydown', arm)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', arm)
      document.removeEventListener('keydown', arm)
    }
  }, [wall])
}
