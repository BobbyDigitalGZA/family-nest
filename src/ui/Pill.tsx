import type { ReactNode } from 'react'
import './clay.css'
import type { PaletteKey } from './palette'

export function Pill({ color, children }: { color: PaletteKey; children: ReactNode }) {
  return (
    <span className="clay-pill" style={{ background: `var(--color-persona-${color})` }}>
      {children}
    </span>
  )
}
