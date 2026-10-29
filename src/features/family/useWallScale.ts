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

const same = (a: WallMetrics, b: WallMetrics) =>
  a.scale === b.scale && a.orientation === b.orientation && a.width === b.width && a.height === b.height

/**
 * Escala de la pared; se recalcula al cambiar el tamaño o la orientación.
 * La app instalada en iOS entrega medidas provisionales al arrancar y las corrige sin `resize`
 * en `window`: por eso también se mide con `visualViewport`, al cargar y en los cuadros siguientes.
 */
export function useWallScale(): WallMetrics {
  const [m, setM] = useState(measure)
  useEffect(() => {
    const update = () =>
      setM((prev) => {
        const next = measure()
        return same(prev, next) ? prev : next
      })
    const vv = window.visualViewport
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    window.addEventListener('load', update)
    window.addEventListener('pageshow', update)
    vv?.addEventListener('resize', update)
    const frame = window.requestAnimationFrame(update)
    const late = window.setTimeout(update, 500)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.removeEventListener('load', update)
      window.removeEventListener('pageshow', update)
      vv?.removeEventListener('resize', update)
      window.cancelAnimationFrame(frame)
      window.clearTimeout(late)
    }
  }, [])
  return m
}
