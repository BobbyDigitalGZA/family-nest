import { useEffect, useState } from 'react'
import { asignar, cambiarCuandoToca, mover, renombrar } from '../../data/actions'
import { loadEvents, type EventRow } from '../../data/repo'
import type { PlainDate, Recurrence } from '../../domain/types'
import { t, type TKey } from '../../i18n/es'
import { errorText } from '../auth/errors'
import { Sheet } from '../../ui/Sheet'
import { DeleteChoice } from './DeleteChoice'
import { dateOfInstant, formatDate, formatInstant } from './format'
import { eventText } from './history'
import { RecurrenceFields } from './RecurrenceFields'
import {
  defaultDraft,
  draftFromRecurrence,
  draftToRecurrence,
  validateDraft,
  type RecurrenceDraft,
} from './recurrenceDraft'
import { useTasksData } from './tasksContext'
import { useDeleteFlow } from './useDeleteFlow'
import { useRunAction } from './useRunAction'
import './tasks.css'

const TYPE_KEY = { once: 'typeOnce', weekly: 'typeWeekly', monthly: 'typeMonthly' } as const

interface TaskDetailProps {
  taskId: string
  /** Fecha original de la ocurrencia que se abrió. */
  originalDate: PlainDate
  open: boolean
  onClose: () => void
}

/** Ventana centrada en la pared, hoja inferior en el iPhone. */
export function TaskDetail({ taskId, originalDate, open, onClose }: TaskDetailProps) {
  const { snapshot, readOnly } = useTasksData()
  const task = snapshot.tasks.find((x) => x.id === taskId)
  // Montado solo mientras está abierto: cada apertura vuelve a leer nombre, fecha y repetición.
  if (!task || !open) return null
  return (
    <DetailBody
      key={task.id}
      taskId={taskId}
      originalDate={originalDate}
      open={open}
      onClose={onClose}
      readOnly={readOnly}
    />
  )
}

function DetailBody({
  taskId,
  originalDate,
  open,
  onClose,
  readOnly,
}: TaskDetailProps & { readOnly: boolean }) {
  const { snapshot } = useTasksData()
  const task = snapshot.tasks.find((x) => x.id === taskId)!
  const { run, error } = useRunAction()
  const del = useDeleteFlow(task, originalDate, onClose)

  const currentDate =
    snapshot.overrides.find((o) => o.taskId === taskId && o.occurrenceDate === originalDate)?.movedTo ??
    originalDate

  const [name, setName] = useState(task.title)
  const [dueDate, setDueDate] = useState<PlainDate>(currentDate)
  const [whenKind, setWhenKind] = useState<'once' | 'repeat'>(task.recurrence.kind === 'once' ? 'once' : 'repeat')
  const [draft, setDraft] = useState<RecurrenceDraft>(() => draftFromRecurrence(task.recurrence, currentDate))
  const [onceDate, setOnceDate] = useState<PlainDate>(originalDate)
  const [invalid, setInvalid] = useState<TKey | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    loadEvents({ taskId }).then(
      (rows) => {
        if (alive) {
          setEvents(rows)
          setEventsError(null)
        }
      },
      (e: unknown) => {
        if (alive) setEventsError(errorText(e))
      },
    )
    return () => {
      alive = false
    }
  }, [open, taskId, version, snapshot])

  const act = async (fn: Parameters<typeof run>[0]) => {
    const ok = await run(fn)
    if (ok) setVersion((v) => v + 1)
    return ok
  }

  const move = async () => {
    if (moving) return
    setMoving(true)
    const target = dueDate
    const ok = await act((a, d) => mover(taskId, originalDate, target, a, d))
    setMoving(false)
    if (!ok) setDueDate(currentDate)
  }

  const saveWhen = async () => {
    setInvalid(null)
    let recurrence: Recurrence
    if (whenKind === 'once') {
      if (!onceDate) return setInvalid('errDateRequired')
      recurrence = { kind: 'once', date: onceDate }
    } else {
      const problem = validateDraft(draft)
      if (problem) return setInvalid(problem)
      recurrence = draftToRecurrence(draft)
    }
    await act((actorId, device) => cambiarCuandoToca(taskId, recurrence, actorId, device))
  }

  const members = snapshot.members
    .filter((m) => m.active || m.id === task.assigneeId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const historyItems = events.flatMap((e) => {
    const text = eventText(e, snapshot.members)
    return text === null ? [] : [{ id: e.id, text, at: formatInstant(e.at, snapshot.family.timeZone) }]
  })

  return (
    <>
      <Sheet open={open} onClose={onClose} title={task.title}>
        <h2 className="fn-title">{task.title}</h2>
        {(error || invalid) && (
          <p role="alert" className="fn-error">
            {invalid ? t(invalid) : error}
          </p>
        )}

        <div className="tk-inline">
          <label className="fn-field" htmlFor="td-name">
            {t('taskName')}
            <input id="td-name" value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
          </label>
          <button
            type="button"
            className="fn-btn"
            disabled={readOnly || name.trim() === '' || name.trim() === task.title}
            onClick={() => void act((a, d) => renombrar(taskId, name, a, d))}
          >
            {t('saveName')}
          </button>
        </div>

        <label className="fn-field" htmlFor="td-who">
          {t('forWhom')}
          <select
            id="td-who"
            value={task.assigneeId}
            disabled={readOnly}
            onChange={(e) => {
              const memberId = e.target.value // se lee ya: el control vuelve a su valor mientras se pregunta quién eres
              void act((a, d) => asignar(taskId, memberId, a, d))
            }}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nickname}
              </option>
            ))}
          </select>
        </label>

        <dl className="tk-facts">
          <dt>{t('detailCreatedOn')}</dt>
          <dd>{formatDate(dateOfInstant(task.createdAt, snapshot.family.timeZone))}</dd>
          <dt>
            <label htmlFor="td-due">{t('detailDueOn')}</label>
          </dt>
          <dd>
            <input
              id="td-due"
              type="date"
              value={dueDate}
              disabled={readOnly}
              onChange={(e) => setDueDate(e.target.value)}
            />{' '}
            <button
              type="button"
              className="fn-btn"
              disabled={readOnly || moving || !dueDate || dueDate === currentDate}
              onClick={() => void move()}
            >
              {t('moveBtn')}
            </button>
          </dd>
          <dt>{t('detailType')}</dt>
          <dd>
            {t('detailTypeTask')} · {t(TYPE_KEY[task.recurrence.kind])}
          </dd>
        </dl>

        <fieldset className="tk-when-set">
          <legend>{t('whenItIs')}</legend>
          <div role="group" aria-label={t('whenItIs')} className="tk-when">
            <button
              type="button"
              className="tk-day tk-when-btn"
              aria-pressed={whenKind === 'once'}
              disabled={readOnly}
              onClick={() => setWhenKind('once')}
            >
              {t('whenOnce')}
            </button>
            <button
              type="button"
              className="tk-day tk-when-btn"
              aria-pressed={whenKind === 'repeat'}
              disabled={readOnly}
              onClick={() => {
                setWhenKind('repeat')
                if (task.recurrence.kind === 'once') setDraft(defaultDraft(currentDate))
              }}
            >
              {t('whenRepeats')}
            </button>
          </div>
          {whenKind === 'once' ? (
            <label className="fn-field" htmlFor="td-once">
              {t('dateLabel')}
              <input
                id="td-once"
                type="date"
                value={onceDate}
                disabled={readOnly}
                onChange={(e) => setOnceDate(e.target.value)}
              />
            </label>
          ) : (
            <RecurrenceFields idPrefix="td" value={draft} onChange={setDraft} disabled={readOnly} />
          )}
          <button type="button" className="fn-btn" disabled={readOnly} onClick={() => void saveWhen()}>
            {t('saveWhen')}
          </button>
        </fieldset>

        <h3 className="tk-subtitle">{t('history')}</h3>
        {eventsError && (
          <p role="alert" className="fn-error">
            {eventsError}
          </p>
        )}
        {historyItems.length === 0 ? (
          <p className="tk-hint">{t('noHistory')}</p>
        ) : (
          <ul className="tk-history" aria-label={t('history')}>
            {historyItems.map((h) => (
              <li key={h.id}>
                <span>{h.text}</span> <time>{h.at}</time>
              </li>
            ))}
          </ul>
        )}

        <div className="tk-actions">
          <button type="button" className="fn-btn" disabled={readOnly} onClick={del.start}>
            {t('deleteLabel')}
          </button>
          <button type="button" className="fn-link" onClick={onClose}>
            {t('close')}
          </button>
        </div>
        {del.error && (
          <p role="alert" className="fn-error">
            {del.error}
          </p>
        )}
      </Sheet>
      <DeleteChoice
        task={task}
        originalDate={originalDate}
        open={del.choosing}
        onClose={del.close}
        onDeleted={onClose}
      />
    </>
  )
}
