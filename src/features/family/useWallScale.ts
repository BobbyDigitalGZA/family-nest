import { useEffect, useState } from 'react'
import { wallScale, type Orientation } from '../../domain/layout'

export interface WallMetrics {
  scale: number
  orientation: Orientation
  /** Tamaño del lienzo en unidades base (ventana ÷ escala). */
  width: number
  height: number
}

function measure(): WallMetrics {
  const w = window.innerWidth
  const h = window.innerHeight
  const { scale, orientation } = wallScale(w, h)
  return { scale, orientation, width: w / scale, height: h / scale }
}

/** Escala de la pared; se recalcula al cambiar el tamaño o la orientación. */
export function useWallScale(): WallMetrics {
  const [m, setM] = useState(measure)
  useEffect(() => {
    const update = () => setM(measure())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
  return m
}
