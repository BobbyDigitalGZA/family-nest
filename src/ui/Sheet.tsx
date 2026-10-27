import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './clay.css'
import { t } from '../i18n/es'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/** Hojas abiertas, de la más antigua a la más reciente: Escape cierra solo la de arriba. */
const openSheets: symbol[] = []

/** Ventana centrada desde 700 px de ancho; hoja inferior por debajo (CSS). */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const id = Symbol('sheet')
    openSheets.push(id)
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openSheets[openSheets.length - 1] === id) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const at = openSheets.indexOf(id)
      if (at >= 0) openSheets.splice(at, 1)
      if (previous?.isConnected) previous.focus()
    }
  }, [open])

  if (!open) return null
  // Por un portal al <body>: una celda con transform no debe encerrar la hoja fija.
  return createPortal(
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
    </div>,
    document.body,
  )
}
