import { useState } from 'react'
import { crearTarea } from '../../data/actions'
import { addDays, todayIn } from '../../domain/dates'
import type { PlainDate } from '../../domain/types'
import { t, type TKey } from '../../i18n/es'
import { Sheet } from '../../ui/Sheet'
import { RecurrenceFields } from './RecurrenceFields'
import {
  defaultDraft,
  draftToRecurrence,
  validateDraft,
  type RecurrenceDraft,
} from './recurrenceDraft'
import { useTasksData } from './tasksContext'
import { useRunAction } from './useRunAction'
import './tasks.css'

type When = 'today' | 'tomorrow' | 'other'

interface NewTaskSheetProps {
  open: boolean
  onClose: () => void
  defaultAssigneeId?: string
  defaultDate?: PlainDate
}

/** Nombre, para quién, cuándo (Hoy, Mañana, Otra fecha), «Se repite» y «De la casa». */
export function NewTaskSheet({ open, onClose, defaultAssigneeId, defaultDate }: NewTaskSheetProps) {
  const { snapshot, readOnly } = useTasksData()
  const { run, error } = useRunAction()
  const today = todayIn(snapshot.family.timeZone, new Date())
  const tomorrow = addDays(today, 1)
  const members = snapshot.members.filter((m) => m.active).sort((a, b) => a.sortOrder - b.sortOrder)

  const initialDate = defaultDate ?? today
  const [title, setTitle] = useState('')
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId ?? members[0]?.id ?? '')
  const [when, setWhen] = useState<When>(
    initialDate === today ? 'today' : initialDate === tomorrow ? 'tomorrow' : 'other',
  )
  const [otherDate, setOtherDate] = useState<PlainDate>(initialDate)
  const [repeats, setRepeats] = useState(false)
  const [draft, setDraft] = useState<RecurrenceDraft | null>(null)
  const [household, setHousehold] = useState(false)
  const [invalid, setInvalid] = useState<TKey | null>(null)

  const date = when === 'today' ? today : when === 'tomorrow' ? tomorrow : otherDate
  const shownDraft = draft ?? defaultDraft(date)

  const pickWhen = (w: When) => {
    setWhen(w)
    setDraft(null) // el inicio de la repetición sigue a la fecha elegida
  }

  const submit = async () => {
    setInvalid(null)
    if (title.trim() === '') return setInvalid('errTitleRequired')
    if (!assigneeId) return setInvalid('errAssigneeRequired')
    if (!date) return setInvalid('errDateRequired')
    let recurrence = { kind: 'once', date } as ReturnType<typeof draftToRecurrence>
    if (repeats) {
      const problem = validateDraft(shownDraft)
      if (problem) return setInvalid(problem)
      recurrence = draftToRecurrence(shownDraft)
    }
    const input = { title: title.trim(), assigneeId, isHousehold: household, recurrence }
    const ok = await run((actorId, device) => crearTarea(input, actorId, device))
    if (ok) {
      setTitle('')
      setRepeats(false)
      setDraft(null)
      setHousehold(false)
      onClose()
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('newTask')}>
      <h2 className="fn-title">{t('newTask')}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className="fn-field" htmlFor="nt-title">
          {t('taskName')}
          <input id="nt-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="fn-field" htmlFor="nt-who">
          {t('forWhom')}
          <select id="nt-who" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nickname}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label={t('when')} className="tk-when">
          {(['today', 'tomorrow', 'other'] as const).map((w) => (
            <button
              key={w}
              type="button"
              className="tk-day tk-when-btn"
              aria-pressed={when === w}
              onClick={() => pickWhen(w)}
            >
              {t(w === 'today' ? 'today' : w === 'tomorrow' ? 'tomorrow' : 'otherDate')}
            </button>
          ))}
        </div>
        {when === 'other' && (
          <label className="fn-field" htmlFor="nt-date">
            {t('dateLabel')}
            <input
              id="nt-date"
              type="date"
              value={otherDate}
              onChange={(e) => {
                setOtherDate(e.target.value)
                setDraft(null)
              }}
            />
          </label>
        )}
        <label className="tk-check-line">
          <input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} />
          {t('repeats')}
        </label>
        {repeats && <RecurrenceFields idPrefix="nt" value={shownDraft} onChange={setDraft} />}
        <label className="tk-check-line">
          <input type="checkbox" checked={household} onChange={(e) => setHousehold(e.target.checked)} />
          {t('household')}
        </label>
        {(invalid || error) && (
          <p role="alert" className="fn-error">
            {invalid ? t(invalid) : error}
          </p>
        )}
        <div className="tk-actions">
          <button type="submit" className="fn-btn" disabled={readOnly}>
            {t('createTaskBtn')}
          </button>
          <button type="button" className="fn-link" onClick={onClose}>
            {t('cancel')}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
