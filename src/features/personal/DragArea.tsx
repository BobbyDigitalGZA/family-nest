import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { mover } from '../../data/actions'
import { canMoveOccurrence } from '../../domain/recurrence'
import { t } from '../../i18n/es'
import { useWallScaleFactor } from '../family/orientationContext'
import { useRunAction } from '../tasks/useRunAction'
import { useTasksData } from '../tasks/tasksContext'
import { parseDragId, parseDropId } from './dayData'
import { formatDayMonth } from './format'

const MESSAGE_MS = 6000

/** El puntero manda; si cae entre celdas, la que más se cruza. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : rectIntersection(args)
}

const ARROWS: Record<string, [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
}

/** Flechas: salta a la celda de día más cercana en esa dirección (lo que dnd-kit no trae para cuadrículas). */
const dayCoordinates: KeyboardCoordinateGetter = (
  event,
  { context: { droppableRects, droppableContainers, collisionRect }, currentCoordinates },
) => {
  const dir = ARROWS[event.code]
  if (!dir || !collisionRect) return undefined
  event.preventDefault()
  const [dx, dy] = dir
  const cx = collisionRect.left + collisionRect.width / 2
  const cy = collisionRect.top + collisionRect.height / 2
  let best: { x: number; y: number; score: number } | null = null
  for (const c of droppableContainers.getEnabled()) {
    const r = droppableRects.get(c.id)
    if (!r) continue
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const along = (x - cx) * dx + (y - cy) * dy
    const across = Math.abs((x - cx) * dy) + Math.abs((y - cy) * dx)
    if (along <= 4) continue
    const score = along + across * 3
    if (!best || score < best.score) best = { x, y, score }
  }
  if (!best) return currentCoordinates
  return { x: best.x - collisionRect.width / 2, y: best.y - collisionRect.height / 2 }
}

/**
 * Contexto de arrastre de Semana y Mes: suelta una ocurrencia en otro día y la mueve (solo esa
 * ocurrencia). Nunca a un día donde la misma tarea ya ocurre: avisa y no llama a la acción.
 */
export function DragArea({ children }: { children: ReactNode }) {
  const { snapshot, readOnly } = useTasksData()
  const { run, error } = useRunAction()
  const scale = useWallScaleFactor()
  const [message, setMessage] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: dayCoordinates }),
  )

  useEffect(() => {
    if (message === null) return
    const id = window.setTimeout(() => setMessage(null), MESSAGE_MS)
    return () => window.clearTimeout(id)
  }, [message])

  const announcements: Announcements = useMemo(() => {
    const titleOf = (id: string | number): string => {
      const from = parseDragId(id)
      return snapshot.tasks.find((x) => x.id === from?.taskId)?.title ?? ''
    }
    const dateOf = (id: string | number): string => {
      const d = parseDropId(id)
      return d ? formatDayMonth(d) : ''
    }
    return {
      onDragStart: ({ active }) => t('dragStartMsg', { title: titleOf(active.id) }),
      onDragOver: ({ active, over }) =>
        over ? t('dragOverMsg', { title: titleOf(active.id), date: dateOf(over.id) }) : undefined,
      onDragEnd: ({ active, over }) =>
        over ? t('dragEndMsg', { title: titleOf(active.id), date: dateOf(over.id) }) : undefined,
      onDragCancel: ({ active }) => t('dragCancelMsg', { title: titleOf(active.id) }),
    }
  }, [snapshot.tasks])

  const activeTitle = useMemo(() => {
    const from = activeId ? parseDragId(activeId) : null
    return snapshot.tasks.find((x) => x.id === from?.taskId)?.title ?? ''
  }, [activeId, snapshot.tasks])

  const onDragStart = (e: DragStartEvent) => {
    setMessage(null)
    setActiveId(String(e.active.id))
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const from = parseDragId(e.active.id)
    const target = e.over ? parseDropId(e.over.id) : null
    if (!from || !target || readOnly) return
    const task = snapshot.tasks.find((x) => x.id === from.taskId)
    if (!task) return
    const check = canMoveOccurrence(task, snapshot.overrides, from.originalDate, target)
    if (!check.ok) {
      setMessage(check.reason === 'already-occurs' ? t('moveAlreadyOccurs') : null)
      return
    }
    setMessage(null)
    void run((actorId, device) => mover(task.id, from.originalDate, target, actorId, device))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('dragInstructions') } }}
    >
      {children}
      <p role="status" data-testid="move-status" className="pv-status" data-empty={message === null}>
        {message}
      </p>
      {error && (
        <p role="alert" className="fn-error">
          {error}
        </p>
      )}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <div className="pv-overlay" style={{ fontSize: `calc(var(--primitive-fontSize-md) * ${scale})` }}>
              {activeTitle}
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
