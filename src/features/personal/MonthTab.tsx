import { useLayoutEffect, useRef, useState } from 'react'
import { monthGrid } from '../../domain/dates'
import type { PlainDate } from '../../domain/types'
import { t } from '../../i18n/es'
import { useTasksData } from '../tasks/tasksContext'
import { DayChip } from './DayChip'
import { DayDialog } from './DayDialog'
import { useNow } from './useNow'
import { itemsByDay, type DayItem } from './dayData'
import { DragArea } from './DragArea'
import { DropDay } from './DropDay'
import { formatDayMonth, formatWeekdayShort } from './format'
import { useIsPhone } from './useIsPhone'

/** Alto de lo que no son tareas en una celda (número del día) y de una tarea y de la línea «+n». */
const HEAD_PX = 30
const CHIP_PX = 28
const MORE_PX = 20
const DEFAULT_SLOTS = 3
const MAX_DOTS = 6

interface MonthTabProps {
  memberId: string
  /** Cualquier día del mes que se ve. */
  cursor: PlainDate
  today: PlainDate
  /** Cuántas tareas caben por día; sin valor se mide de la cuadrícula. */
  visibleSlots?: number
}

/** Cuántas tareas caben en una celda de la cuadrícula; el resto va como «+n». */
function useSlots(grid: React.RefObject<HTMLDivElement | null>, rows: number, forced?: number): number {
  const [measured, setMeasured] = useState(DEFAULT_SLOTS)
  useLayoutEffect(() => {
    const el = grid.current
    if (forced !== undefined || !el) return
    const update = () => {
      if (el.clientHeight === 0) return // sin medidas (aún no se dibuja): vale el valor por defecto
      const cell = el.clientHeight / rows
      setMeasured(Math.max(1, Math.floor((cell - HEAD_PX - MORE_PX) / CHIP_PX)))
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [grid, rows, forced])
  return forced ?? measured
}

/** Cuadrícula de lunes a domingo del mes visto. */
export function MonthTab({ memberId, cursor, today, visibleSlots }: MonthTabProps) {
  const { snapshot } = useTasksData()
  const now = useNow()
  const phone = useIsPhone()
  const [openDate, setOpenDate] = useState<PlainDate | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const year = Number(cursor.slice(0, 4))
  const month = Number(cursor.slice(5, 7))
  const days = monthGrid(year, month)
  const first = days[0] as PlainDate
  const last = days[days.length - 1] as PlainDate
  const byDay = itemsByDay(snapshot, memberId, first, last, now)
  const slots = useSlots(gridRef, days.length / 7, visibleSlots)
  const inMonth = (d: PlainDate) => Number(d.slice(5, 7)) === month

  const grid = (
    <>
      <div className="pv-weekdays" aria-hidden="true">
        {days.slice(0, 7).map((d) => (
          <span key={d}>{formatWeekdayShort(d)}</span>
        ))}
      </div>
      <div className="pv-month" ref={gridRef} data-rows={days.length / 7}>
        {days.map((d) => {
          const items = byDay.get(d) ?? []
          const isToday = d === today
          if (phone) return <PhoneCell key={d} date={d} items={items} today={isToday} outside={!inMonth(d)} onOpen={setOpenDate} />
          const shown = items.length > slots ? items.slice(0, slots) : items
          const more = items.length - shown.length
          return (
            <DropDay key={d} date={d} className="pv-cell" today={isToday} outside={!inMonth(d)}>
              <div className="pv-cell-head">
                <button type="button" className="pv-cell-num" aria-label={formatDayMonth(d)} onClick={() => setOpenDate(d)}>
                  {Number(d.slice(8))}
                </button>
                {isToday && <span className="pv-today-tag">{t('todayLabel')}</span>}
              </div>
              <ul className="pv-chips">
                {shown.map((item) => (
                  <DayChip key={`${item.task.id}:${item.occurrence.originalDate}`} item={item} />
                ))}
              </ul>
              {more > 0 && (
                <button type="button" className="pv-more" onClick={() => setOpenDate(d)}>
                  {t('moreCount', { n: more })}
                </button>
              )}
            </DropDay>
          )
        })}
      </div>
    </>
  )

  return (
    <>
      {phone ? grid : <DragArea>{grid}</DragArea>}
      {openDate && <DayDialog date={openDate} memberId={memberId} open onClose={() => setOpenDate(null)} />}
    </>
  )
}

/** En el iPhone: puntos por día y el día entero se toca. */
function PhoneCell({
  date,
  items,
  today,
  outside,
  onOpen,
}: {
  date: PlainDate
  items: DayItem[]
  today: boolean
  outside: boolean
  onOpen: (d: PlainDate) => void
}) {
  return (
    <button
      type="button"
      className="pv-cell pv-cell-phone"
      data-testid={`day-${date}`}
      data-today={today}
      data-outside={outside}
      aria-label={`${formatDayMonth(date)}, ${items.length === 1 ? t('dotsLabelOne') : t('dotsLabel', { n: items.length })}`}
      onClick={() => onOpen(date)}
    >
      <span className="pv-cell-num">{Number(date.slice(8))}</span>
      {today && <span className="pv-today-tag">{t('todayLabel')}</span>}
      <span className="pv-dots" aria-hidden="true">
        {items.slice(0, MAX_DOTS).map((item) => (
          <span key={`${item.task.id}:${item.occurrence.originalDate}`} className="pv-dot" data-dot={item.state} />
        ))}
      </span>
    </button>
  )
}
