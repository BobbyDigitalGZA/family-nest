import { useState, type KeyboardEvent } from 'react'
import { compliance, formatCompliance } from '../../domain/completion'
import { addDays, lastDayOfMonth, weekStart } from '../../domain/dates'
import type { PlainDate } from '../../domain/types'
import { t } from '../../i18n/es'
import { ProgressBar } from '../../ui/ProgressBar'
import { useToday } from '../family/useToday'
import { WallFrame } from '../family/WallFrame'
import { asPalette } from '../family/palette'
import { useActor } from '../identity/useActor'
import { NewTaskSheet } from '../tasks/NewTaskSheet'
import { useTasksData } from '../tasks/tasksContext'
import { occurrencesOf } from './dayData'
import { formatMonthTitle, formatShort } from './format'
import { MonthTab } from './MonthTab'
import { TodayTab } from './TodayTab'
import { WeekTab } from './WeekTab'
import './personal.css'

type Tab = 'today' | 'week' | 'month'
const TABS: { id: Tab; label: 'tabToday' | 'tabWeek' | 'tabMonth' }[] = [
  { id: 'today', label: 'tabToday' },
  { id: 'week', label: 'tabWeek' },
  { id: 'month', label: 'tabMonth' },
]

/** Primer y último día del periodo que decide el cumplimiento. */
function rangeOf(tab: Tab, anchor: PlainDate): [PlainDate, PlainDate] {
  if (tab === 'today') return [anchor, anchor]
  if (tab === 'week') {
    const start = weekStart(anchor)
    return [start, addDays(start, 6)]
  }
  const year = Number(anchor.slice(0, 4))
  const month = Number(anchor.slice(5, 7))
  const mm = anchor.slice(5, 7)
  return [`${year}-${mm}-01`, `${year}-${mm}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`]
}

/** Un mes antes o después, siempre sobre el día 1 (los meses no tienen el mismo largo). */
function shiftMonth(d: PlainDate, by: number): PlainDate {
  const total = Number(d.slice(0, 4)) * 12 + (Number(d.slice(5, 7)) - 1) + by
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}-01`
}

interface PersonalViewProps {
  memberId: string
  /** Vuelve a la vista familiar. */
  onBack: () => void
}

/** Vista de una persona: Hoy, Semana y Mes. La pestaña activa decide el rango del cumplimiento. */
export function PersonalView({ memberId, onBack }: PersonalViewProps) {
  return (
    <WallFrame>
      <Personal memberId={memberId} onBack={onBack} />
    </WallFrame>
  )
}

function Personal({ memberId, onBack }: PersonalViewProps) {
  const { snapshot, readOnly } = useTasksData()
  const { backToFamily } = useActor()
  const today = useToday(snapshot.family.timeZone)
  const [tab, setTab] = useState<Tab>('today')
  // null = sigue a «hoy» (cruza la medianoche sin quedarse en el día anterior).
  const [cursor, setCursor] = useState<PlainDate | null>(null)
  const [creating, setCreating] = useState(false)

  const person = snapshot.members.find((m) => m.id === memberId)
  const color = asPalette(person?.color ?? 'blue')
  const anchor = cursor ?? today
  const [from, to] = rangeOf(tab, anchor)
  const c = compliance(occurrencesOf(snapshot, memberId, from, to), snapshot.completions)

  const choose = (next: Tab) => {
    setTab(next)
    setCursor(null)
  }
  const back = () => {
    backToFamily()
    onBack()
  }
  const move = (dir: -1 | 1) =>
    setCursor(tab === 'week' ? addDays(weekStart(anchor), 7 * dir) : shiftMonth(anchor, dir))
  const atToday = tab === 'week' ? weekStart(anchor) === weekStart(today) : anchor.slice(0, 7) === today.slice(0, 7)

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((x) => x.id === tab)
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null
    if (next === null) return
    const target = TABS[(next + TABS.length) % TABS.length]
    if (target) {
      e.preventDefault()
      choose(target.id)
      document.getElementById(`pv-tab-${target.id}`)?.focus()
    }
  }

  const heading =
    tab === 'week'
      ? t('weekRange', { from: formatShort(weekStart(anchor)), to: formatShort(addDays(weekStart(anchor), 6)) })
      : formatMonthTitle(anchor)

  return (
    <main
      className="pv-root"
      style={{
        ['--pv-c' as string]: `var(--color-persona-${color})`,
        ['--pv-ch' as string]: `var(--color-persona-${color}-hondo)`,
      }}
    >
      <header className="pv-top">
        <button type="button" className="fn-btn pv-back" onClick={back}>
          <span aria-hidden="true">‹ </span>
          {t('backToFamily')}
        </button>
        <h2 className="pv-name ellipsis" title={person?.nickname}>
          {person?.nickname}
        </h2>
        <div className="pv-tabs" role="tablist" aria-label={t('tabsLabel')} onKeyDown={onTabKey}>
          {TABS.map((x) => (
            <button
              key={x.id}
              id={`pv-tab-${x.id}`}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              aria-controls="pv-panel"
              tabIndex={tab === x.id ? 0 : -1}
              className="pv-tab"
              onClick={() => choose(x.id)}
            >
              {t(x.label)}
            </button>
          ))}
        </div>
        <button type="button" className="fn-btn pv-new" disabled={readOnly} onClick={() => setCreating(true)}>
          {t('newTask')}
        </button>
      </header>

      <div className="pv-compliance" data-testid="compliance">
        <span className="pv-compliance-text">{formatCompliance(c)}</span>
        <ProgressBar value={c.percent} color={color} ariaLabel={t('complianceLabel', { nickname: person?.nickname ?? '' })} />
      </div>

      {tab !== 'today' && (
        <div className="pv-nav">
          <button type="button" className="pv-arrow" aria-label={tab === 'week' ? t('prevWeek') : t('prevMonth')} onClick={() => move(-1)}>
            <span aria-hidden="true">‹</span>
          </button>
          <h3 className="pv-heading">{heading}</h3>
          <button type="button" className="pv-arrow" aria-label={tab === 'week' ? t('nextWeek') : t('nextMonth')} onClick={() => move(1)}>
            <span aria-hidden="true">›</span>
          </button>
          <button type="button" className="fn-link" disabled={atToday} onClick={() => setCursor(null)}>
            {t('backToToday')}
          </button>
        </div>
      )}

      <div id="pv-panel" role="tabpanel" aria-labelledby={`pv-tab-${tab}`} className="pv-body">
        {tab === 'today' && <TodayTab memberId={memberId} today={today} />}
        {tab === 'week' && <WeekTab memberId={memberId} cursor={anchor} today={today} />}
        {tab === 'month' && <MonthTab memberId={memberId} cursor={anchor} today={today} />}
      </div>

      <NewTaskSheet open={creating} onClose={() => setCreating(false)} defaultAssigneeId={memberId} defaultDate={from > today ? from : today} />
    </main>
  )
}
