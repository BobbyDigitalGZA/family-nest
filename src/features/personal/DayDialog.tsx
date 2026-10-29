import { useState } from 'react'
import type { PlainDate } from '../../domain/types'
import { t } from '../../i18n/es'
import { Sheet } from '../../ui/Sheet'
import { NewTaskSheet } from '../tasks/NewTaskSheet'
import { TaskRow } from '../tasks/TaskRow'
import { useTasksData } from '../tasks/tasksContext'
import { useNow } from './useNow'
import { itemsByDay } from './dayData'
import { formatDayLong } from './format'

interface DayDialogProps {
  date: PlainDate
  memberId: string
  open: boolean
  onClose: () => void
}

/** Todo un día: desde aquí se cumple, se abre el detalle o se crea una tarea para esa fecha. */
export function DayDialog({ date, memberId, open, onClose }: DayDialogProps) {
  const { snapshot, readOnly } = useTasksData()
  const now = useNow()
  const [creating, setCreating] = useState(false)
  const items = itemsByDay(snapshot, memberId, date, date, now).get(date) ?? []
  const title = formatDayLong(date)
  return (
    <>
      <Sheet open={open} onClose={onClose} title={title}>
        <h2 className="pv-dialog-title">{title}</h2>
        {items.length === 0 ? (
          <p className="pv-empty">{t('noTasksDay')}</p>
        ) : (
          <ul className="pv-list">
            {items.map(({ task, occurrence }) => (
              <TaskRow key={`${task.id}:${occurrence.originalDate}`} task={task} occurrence={occurrence} />
            ))}
          </ul>
        )}
        <div className="tk-actions">
          <button type="button" className="fn-btn" disabled={readOnly} onClick={() => setCreating(true)}>
            {t('newTask')}
          </button>
          <button type="button" className="fn-link" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </Sheet>
      <NewTaskSheet open={creating} onClose={() => setCreating(false)} defaultAssigneeId={memberId} defaultDate={date} />
    </>
  )
}
