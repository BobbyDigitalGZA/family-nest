import { isoWeekday } from '../../domain/dates'
import { validateRecurrence, type RecurrenceProblem } from '../../domain/recurrence'
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

const PROBLEM_KEY: Record<RecurrenceProblem, TKey> = {
  'date-required': 'errDateRequired',
  'weekdays-required': 'errWeekdaysRequired',
  'day-of-month-invalid': 'errDayOfMonth',
  'end-before-start': 'errEndBeforeStart',
}

/** Mensaje en línea; la regla vive en el dominio (validateRecurrence) y también la aplica la capa de acciones. */
export function validateDraft(d: RecurrenceDraft): TKey | null {
  const problem = validateRecurrence(draftToRecurrence(d))
  return problem ? PROBLEM_KEY[problem] : null
}

export function draftToRecurrence(d: RecurrenceDraft): Recurrence {
  return d.kind === 'weekly'
    ? { kind: 'weekly', weekdays: [...d.weekdays].sort((a, b) => a - b), start: d.start, end: d.end }
    : { kind: 'monthly', dayOfMonth: d.dayOfMonth, start: d.start, end: d.end }
}
