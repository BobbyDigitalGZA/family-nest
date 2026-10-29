import { addDays, daysBetween, weekStart } from '../../domain/dates'
import type { PlainDate } from '../../domain/types'
import { t } from '../../i18n/es'
import { useTasksData } from '../tasks/tasksContext'
import { DayChip } from './DayChip'
import { useNow } from './useNow'
import { itemsByDay } from './dayData'
import { DragArea } from './DragArea'
import { DropDay } from './DropDay'
import { formatWeekdayLong, formatWeekdayShort } from './format'

interface WeekTabProps {
  memberId: string
  /** Cualquier día de la semana que se ve. */
  cursor: PlainDate
  today: PlainDate
}

/** Siete columnas de lunes a domingo; las ocurrencias se arrastran de un día a otro. */
export function WeekTab({ memberId, cursor, today }: WeekTabProps) {
  const { snapshot } = useTasksData()
  const now = useNow()
  const start = weekStart(cursor)
  const days = daysBetween(start, addDays(start, 6))
  const byDay = itemsByDay(snapshot, memberId, start, addDays(start, 6), now)
  return (
    <DragArea>
      <div className="pv-week">
        {days.map((d) => {
          const items = byDay.get(d) ?? []
          return (
            <DropDay key={d} date={d} className="pv-day" today={d === today}>
              <h3 className="pv-day-head">
                <span className="pv-wd-short">{formatWeekdayShort(d)}</span>
                <span className="pv-wd-long">{formatWeekdayLong(d)}</span>
                <span className="pv-day-num">{Number(d.slice(8))}</span>
                {d === today && <span className="pv-today-tag">{t('todayLabel')}</span>}
              </h3>
              <ul className="pv-chips">
                {items.map((item) => (
                  <DayChip key={`${item.task.id}:${item.occurrence.originalDate}`} item={item} />
                ))}
              </ul>
            </DropDay>
          )
        })}
      </div>
    </DragArea>
  )
}
