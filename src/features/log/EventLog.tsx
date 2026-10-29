import { useEffect, useMemo, useState } from 'react'
import { loadEvents, type EventRow } from '../../data/repo'
import { addDays, localTimeIn, todayIn, weekStart } from '../../domain/dates'
import type { EventType } from '../../domain/events'
import { t, type TKey } from '../../i18n/es'
import { errorText } from '../auth/errors'
import { useToday } from '../family/useToday'
import { useTasksData } from '../tasks/tasksContext'
import { eventLabel, toCsv, weekOfEvent, weeklySummary } from './toCsv'
import './log.css'

const TYPES: EventType[] = [
  'created', 'assigned', 'renamed', 'recurrence_changed', 'moved', 'completed',
  'uncompleted', 'deleted_occurrence', 'deleted_series', 'excused', 'day_off_set', 'day_off_cleared',
]

function stamp(at: string, timeZone: string): string {
  const d = new Date(at)
  return `${todayIn(timeZone, d)} ${localTimeIn(timeZone, d)}`
}

function download(name: string, csv: string) {
  // BOM so Excel reads the accents as UTF-8.
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Safari/iOS needs the URL alive a moment after the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Registro de eventos: solo lectura. Resumen de la semana, lista filtrable y CSV. */
export function EventLog({ onBack }: { onBack: () => void }) {
  const { snapshot, readOnly } = useTasksData()
  const { members, family } = snapshot
  const today = useToday(family.timeZone)
  const [offset, setOffset] = useState(0)
  const [events, setEvents] = useState<EventRow[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [person, setPerson] = useState('')
  const [action, setAction] = useState('')

  const start = addDays(weekStart(today), offset * 7)
  // One day of padding on each side covers time-zone offsets; the exact week is filtered below.
  const from = `${addDays(start, -1)}T00:00:00Z`
  const to = `${addDays(start, 8)}T00:00:00Z`

  const key = `${from}|${to}`
  const loading = !readOnly && loadedKey !== key

  useEffect(() => {
    // Demostración: no hay base de datos que leer.
    if (readOnly) return
    let alive = true
    loadEvents({ from, to }).then(
      (rows) => {
        if (!alive) return
        setEvents(rows)
        setError(null)
        setLoadedKey(key)
      },
      (e: unknown) => {
        if (!alive) return
        setError(errorText(e))
        setLoadedKey(key)
      },
    )
    return () => {
      alive = false
    }
  }, [readOnly, from, to, key])

  const nick = (id: string) => members.find((m) => m.id === id)?.nickname ?? t('logUnknownActor')
  const inWeek = useMemo(
    () => events.filter((e) => weekOfEvent(e.at, family.timeZone) === start),
    [events, start, family.timeZone],
  )
  const shown = useMemo(
    () => inWeek.filter((e) => (!person || e.actorId === person) && (!action || e.type === action)),
    [inWeek, person, action],
  )
  const summary = weeklySummary(events, start, family.timeZone, members)

  return (
    <main className="lg-root">
      <header className="lg-top">
        <button type="button" className="fn-btn" onClick={onBack}>
          <span aria-hidden="true">‹ </span>
          {t('logBack')}
        </button>
        <h2 className="lg-title">{t('logTitle')}</h2>
        <button type="button" className="fn-btn" onClick={() => download(t('logFile', { date: start }), toCsv(shown, members, family.timeZone))}>
          {t('logDownload')}
        </button>
      </header>
      <div className="lg-week">
        <button type="button" className="fn-btn" onClick={() => setOffset(offset - 1)}>
          {t('logPrevWeek')}
        </button>
        <span>{t('logWeekOf', { date: start })}</span>
        <button type="button" className="fn-btn" onClick={() => setOffset(offset + 1)}>
          {t('logNextWeek')}
        </button>
      </div>
      {error && (
        <p role="alert" className="fn-error">
          {error}
        </p>
      )}
      {readOnly && <p className="lg-note">{t('readOnlyNote')}</p>}
      {loading && <p role="status">{t('loading')}</p>}
      <section aria-label={t('logSummary')}>
        <h3 className="lg-sub">{t('logSummary')}</h3>
        {loading ? null : summary.length === 0 ? (
          <p>{t('logSummaryEmpty')}</p>
        ) : (
          <table className="lg-table">
            <thead>
              <tr>
                <th scope="col">{t('logPerson')}</th>
                <th scope="col">{t('logCreated')}</th>
                <th scope="col">{t('logAssigned')}</th>
                <th scope="col">{t('logCompleted')}</th>
                <th scope="col">{t('logMoved')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={r.memberId}>
                  <th scope="row">{nick(r.memberId)}</th>
                  <td>{r.created}</td>
                  <td>{r.assigned}</td>
                  <td>{r.completed}</td>
                  <td>{r.moved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <div className="lg-filters">
        <label>
          {t('logPerson')}{' '}
          <select value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">{t('logAllMasc')}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nickname}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('logAction')}{' '}
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">{t('logAll')}</option>
            {TYPES.map((x) => (
              <option key={x} value={x}>
                {eventLabel(x)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? null : shown.length === 0 ? (
        <p>{t('logNone')}</p>
      ) : (
        <ul className="lg-list" aria-label={t('logTitle')}>
          {shown.map((e) => (
            <li key={e.id}>
              {stamp(e.at, family.timeZone)} · {nick(e.actorId)}{' '}
              {eventLabel(e.type)}
              {e.taskTitle ? ` · ${e.taskTitle}` : ''} · {t(`device.${e.device}` as TKey)}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
