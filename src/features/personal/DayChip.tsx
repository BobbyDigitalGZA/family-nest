import { useDraggable } from '@dnd-kit/core'
import { useEffect, useState } from 'react'
import { completar, desmarcar } from '../../data/actions'
import { t } from '../../i18n/es'
import { Checkbox } from '../../ui/Checkbox'
import { clearFollow, isFollowed } from '../tasks/detailFollow'
import { TaskDetail } from '../tasks/TaskDetail'
import { useTasksData } from '../tasks/tasksContext'
import { useRunAction } from '../tasks/useRunAction'
import { dragId, type DayItem } from './dayData'

/**
 * Ocurrencia compacta de Semana y Mes: casilla, nombre (abre el detalle) y asa para moverla.
 * Se arrastra tomándola de cualquier parte; con teclado, desde el asa.
 */
export function DayChip({ item }: { item: DayItem }) {
  const { readOnly } = useTasksData()
  const { run, error } = useRunAction()
  const { task, occurrence, state, locked } = item
  const [open, setOpen] = useState(() => isFollowed(task.id, occurrence.originalDate))
  useEffect(() => clearFollow(task.id, occurrence.originalDate), [task.id, occurrence.originalDate])
  const done = state === 'done'
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: dragId(task.id, occurrence.originalDate),
    disabled: readOnly || locked,
  })

  const toggle = () =>
    void run((actorId, device) =>
      done
        ? desmarcar(task.id, occurrence.originalDate, actorId, device)
        : completar(task.id, occurrence.originalDate, actorId, device),
    )

  return (
    <>
    <li
      ref={setNodeRef}
      className="pv-chip"
      data-state={state}
      data-dragging={isDragging}
      title={task.title}
      {...listeners}
    >
      <Checkbox
        checked={done}
        onToggle={toggle}
        disabled={readOnly || locked || occurrence.excused}
        ariaLabel={t('completeTask', { title: task.title })}
      />
      <button type="button" className="pv-chip-title" onClick={() => setOpen(true)}>
        {task.title}
      </button>
      {!readOnly && !locked && (
        <button
          type="button"
          className="pv-grip"
          ref={setActivatorNodeRef}
          {...attributes}
          aria-label={t('moveHandle', { title: task.title })}
        >
          <span aria-hidden="true">⠿</span>
        </button>
      )}
      {error && (
        <span role="alert" className="pv-chip-error">
          {error}
        </span>
      )}
    </li>
    {/* Fuera del <li>: los eventos de un portal suben por React hasta quien lo montó, y el <li> arrastra. */}
    <TaskDetail taskId={task.id} originalDate={occurrence.originalDate} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
