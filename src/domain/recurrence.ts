import { addDays, daysBetween, isoWeekday, lastDayOfMonth } from './dates'
import type {
  Occurrence,
  OccurrenceOverride,
  PlainDate,
  Recurrence,
  Task,
} from './types'

function isScheduledOn(r: Recurrence, d: PlainDate): boolean {
  switch (r.kind) {
    case 'once':
      return r.date === d
    case 'weekly':
      return (
        d >= r.start &&
        (r.end === null || d <= r.end) &&
        r.weekdays.includes(isoWeekday(d))
      )
    case 'monthly': {
      if (d < r.start || (r.end !== null && d > r.end)) return false
      const [y, m, day] = d.split('-').map(Number) as [number, number, number]
      return day === Math.min(r.dayOfMonth, lastDayOfMonth(y, m))
    }
  }
}

function baseDates(r: Recurrence, from: PlainDate, to: PlainDate): PlainDate[] {
  return daysBetween(from, to).filter((d) => isScheduledOn(r, d))
}

function overrideFor(
  overrides: OccurrenceOverride[],
  taskId: string,
  originalDate: PlainDate,
): OccurrenceOverride | undefined {
  return overrides.find(
    (x) => x.taskId === taskId && x.occurrenceDate === originalDate,
  )
}

export function occurrencesBetween(
  task: Task,
  overrides: OccurrenceOverride[],
  from: PlainDate,
  to: PlainDate,
): Occurrence[] {
  if (task.deletedAt !== null) return []

  // Originals in range, plus originals outside it that were moved into it.
  const originals = new Set(baseDates(task.recurrence, from, to))
  for (const ov of overrides) {
    if (
      ov.taskId === task.id &&
      ov.movedTo !== null &&
      isScheduledOn(task.recurrence, ov.occurrenceDate)
    ) {
      originals.add(ov.occurrenceDate)
    }
  }

  const out: Occurrence[] = []
  for (const originalDate of originals) {
    const ov = overrideFor(overrides, task.id, originalDate)
    if (ov?.deleted) continue
    const date = ov?.movedTo ?? originalDate
    if (date < from || date > to) continue
    out.push({
      taskId: task.id,
      originalDate,
      date,
      excused: (ov?.excusedById ?? null) !== null,
    })
  }
  return out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.originalDate.localeCompare(b.originalDate),
  )
}

export function canMoveOccurrence(
  task: Task,
  overrides: OccurrenceOverride[],
  originalDate: PlainDate,
  target: PlainDate,
): { ok: true } | { ok: false; reason: 'same-date' | 'already-occurs' } {
  const currentDate =
    overrideFor(overrides, task.id, originalDate)?.movedTo ?? originalDate
  if (target === currentDate) return { ok: false, reason: 'same-date' }
  if (occurrencesBetween(task, overrides, target, target).length > 0) {
    return { ok: false, reason: 'already-occurs' }
  }
  return { ok: true }
}

/** "Delete all": ends the series from max(occurrenceDate, today); the past is kept. */
export function endSeriesFrom(
  task: Task,
  occurrenceDate: PlainDate,
  today: PlainDate,
): Recurrence | 'delete-task' {
  const cut = occurrenceDate > today ? occurrenceDate : today
  const r = task.recurrence
  if (r.kind === 'once') return r.date >= cut ? 'delete-task' : r
  if (r.start >= cut) return 'delete-task'
  const end = addDays(cut, -1)
  // Never extend a series that already ends before the cut.
  return { ...r, end: r.end !== null && r.end < end ? r.end : end }
}

export type RecurrenceProblem =
  | 'date-required'
  | 'weekdays-required'
  | 'day-of-month-invalid'
  | 'end-before-start'

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Reglas de una recurrencia antes de guardarla; null si es válida. */
export function validateRecurrence(r: Recurrence): RecurrenceProblem | null {
  if (r.kind === 'once') return PLAIN_DATE.test(r.date) ? null : 'date-required'
  if (!PLAIN_DATE.test(r.start)) return 'date-required'
  if (r.kind === 'weekly' && r.weekdays.length === 0) return 'weekdays-required'
  if (r.kind === 'monthly' && !(Number.isInteger(r.dayOfMonth) && r.dayOfMonth >= 1 && r.dayOfMonth <= 31)) {
    return 'day-of-month-invalid'
  }
  if (r.end !== null) {
    if (!PLAIN_DATE.test(r.end)) return 'date-required'
    if (r.end < r.start) return 'end-before-start'
  }
  return null
}
