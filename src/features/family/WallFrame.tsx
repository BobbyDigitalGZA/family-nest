import { useEffect, useState, type ReactNode } from 'react'
import { t } from '../../i18n/es'
import { OrientationContext } from './orientationContext'
import { useWallScale } from './useWallScale'
import './family.css'

const canFullscreen = (): boolean =>
  typeof document.documentElement.requestFullscreen === 'function'

function FullscreenButton() {
  const [full, setFull] = useState(() => document.fullscreenElement != null)
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
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
  return (
    <div className="fv-wall" data-orientation={orientation}>
      <div
        className="fv-canvas"
        data-testid="wall-canvas"
        style={{ width, height, transform: `scale(${scale})` }}
      >
        <OrientationContext.Provider value={orientation}>{children}</OrientationContext.Provider>
      </div>
      <FullscreenButton />
    </div>
  )
}
