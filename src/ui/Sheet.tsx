import { useEffect, useRef, type ReactNode } from 'react'
import './clay.css'
import { t } from '../i18n/es'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/** Ventana centrada desde 700 px de ancho; hoja inferior por debajo (CSS). */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="clay-sheet-backdrop" data-testid="sheet-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="clay-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title ?? t('appName')}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
