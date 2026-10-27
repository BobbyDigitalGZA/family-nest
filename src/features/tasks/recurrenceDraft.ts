import { isoWeekday } from '../../domain/dates'
import type { PlainDate, Recurrence, Weekday } from '../../domain/types'
import type { TKey } from '../../i18n/es'

export interface RecurrenceDraft {
  kind: 'weekly' | 'monthly'
  weekdays: Weekday[]
  dayOfMonth: number
  start: PlainDate
  /** null = "Sin fecha de fin" */
  end: PlainDate | null
}

export function defaultDraft(start: PlainDate): RecurrenceDraft {
  return {
    kind: 'weekly',
    weekdays: [isoWeekday(start)],
    dayOfMonth: Number(start.slice(8, 10)),
    start,
    end: null,
  }
}

export function draftFromRecurrence(r: Recurrence, fallbackStart: PlainDate): RecurrenceDraft {
  if (r.kind === 'once') return defaultDraft(fallbackStart)
  const base = defaultDraft(r.start)
  return r.kind === 'weekly'
    ? { ...base, kind: 'weekly', weekdays: r.weekdays, start: r.start, end: r.end }
    : { ...base, kind: 'monthly', dayOfMonth: r.dayOfMonth, start: r.start, end: r.end }
}

export function validateDraft(d: RecurrenceDraft): TKey | null {
  if (!d.start) return 'errDateRequired'
  if (d.kind === 'weekly' && d.weekdays.length === 0) return 'errWeekdaysRequired'
  if (d.kind === 'monthly' && !(Number.isInteger(d.dayOfMonth) && d.dayOfMonth >= 1 && d.dayOfMonth <= 31)) {
    return 'errDayOfMonth'
  }
  if (d.end !== null) {
    if (d.end === '') return 'errDateRequired'
    if (d.end < d.start) return 'errEndBeforeStart'
  }
  return null
}

export function draftToRecurrence(d: RecurrenceDraft): Recurrence {
  return d.kind === 'weekly'
    ? { kind: 'weekly', weekdays: [...d.weekdays].sort((a, b) => a - b), start: d.start, end: d.end }
    : { kind: 'monthly', dayOfMonth: d.dayOfMonth, start: d.start, end: d.end }
}
