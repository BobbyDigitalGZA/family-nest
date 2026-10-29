import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { t } from '../../i18n/es'
import { OrientationContext, WallScaleContext } from './orientationContext'
import { useWallScale } from './useWallScale'
import './family.css'

const canFullscreen = (): boolean =>
  typeof document.documentElement.requestFullscreen === 'function'

/** Safari en iPad dibuja su propia ✕ arriba a la izquierda en pantalla completa. */
const isIpadSafari = (): boolean =>
  /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Franja (px reales) que se deja libre arriba para esa ✕. */
const SAFARI_FULLSCREEN_INSET = 56

function useFullscreen(): boolean {
  const [full, setFull] = useState(() => document.fullscreenElement != null)
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  return full
}

function FullscreenButton({ full }: { full: boolean }) {
  if (!canFullscreen()) return null
  const toggle = () => {
    const op = full ? document.exitFullscreen() : document.documentElement.requestFullscreen()
    void op.catch(() => {})
  }
  return (
    <button type="button" className="fv-fullscreen" onClick={toggle}>
      {full ? t('exitFullscreen') : t('fullscreen')}
    </button>
  )
}

/** Ocupa todo el monitor: lienzo base de 1280 × 800 (o 800 × 1280) escalado entre 1× y 3×. */
export function WallFrame({ children }: { children: ReactNode }) {
  const { scale, orientation, width, height } = useWallScale()
  const full = useFullscreen()
  const inset = full && isIpadSafari() ? SAFARI_FULLSCREEN_INSET : 0
  return (
    <div
      className="fv-wall"
      data-orientation={orientation}
      style={{ '--wall-scale': scale } as CSSProperties}
    >
      <div
        className="fv-canvas"
        data-testid="wall-canvas"
        style={{
          width,
          height: height - inset / scale,
          transform: inset ? `translateY(${inset}px) scale(${scale})` : `scale(${scale})`,
        }}
      >
        <WallScaleContext.Provider value={scale}>
          <OrientationContext.Provider value={orientation}>{children}</OrientationContext.Provider>
        </WallScaleContext.Provider>
      </div>
      <FullscreenButton full={full} />
    </div>
  )
}
