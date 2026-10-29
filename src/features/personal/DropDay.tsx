import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import type { PlainDate } from '../../domain/types'
import { dropId } from './dayData'

interface DropDayProps {
  date: PlainDate
  className: string
  today: boolean
  outside?: boolean
  children: ReactNode
}

/** Un día donde se puede soltar una ocurrencia (Semana y Mes). */
export function DropDay({ date, className, today, outside = false, children }: DropDayProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(date) })
  return (
    <div
      ref={setNodeRef}
      className={className}
      data-testid={`day-${date}`}
      data-today={today}
      data-outside={outside}
      data-over={isOver}
    >
      {children}
    </div>
  )
}
