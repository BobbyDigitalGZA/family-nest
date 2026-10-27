import { t } from '../../i18n/es'
import { TaskRow } from '../tasks/TaskRow'
import { useTasksData } from '../tasks/tasksContext'
import { useNow } from './useNow'
import { itemsByDay } from './dayData'

/** Las tareas de la persona para hoy, con la misma fila que la vista familiar. */
export function TodayTab({ memberId, today }: { memberId: string; today: string }) {
  const { snapshot } = useTasksData()
  const now = useNow()
  const items = itemsByDay(snapshot, memberId, today, today, now).get(today) ?? []
  if (items.length === 0) return <p className="pv-empty">{t('noTasksToday')}</p>
  return (
    <ul className="pv-list">
      {items.map(({ task, occurrence }) => (
        <TaskRow key={`${task.id}:${occurrence.originalDate}`} task={task} occurrence={occurrence} />
      ))}
    </ul>
  )
}
