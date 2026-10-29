import type { ReactNode } from 'react'
import './clay.css'

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={className ? `clay-panel ${className}` : 'clay-panel'}>{children}</section>
}
