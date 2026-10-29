import type { PlainDate, Weekday } from './types'

const DAY_MS = 86_400_000

function parse(d: PlainDate): number {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, day)
}

function format(ms: number): PlainDate {
  return new Date(ms).toISOString().slice(0, 10)
}

function localParts(timeZone: string, now: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  return Object.fromEntries(parts.map((p) => [p.type, p.value]))
}

export function todayIn(timeZone: string, now: Date): PlainDate {
  const p = localParts(timeZone, now)
  return `${p.year}-${p.month}-${p.day}`
}

export function localTimeIn(timeZone: string, now: Date): string {
  const p = localParts(timeZone, now)
  return `${p.hour}:${p.minute}`
}

export function addDays(d: PlainDate, n: number): PlainDate {
  return format(parse(d) + n * DAY_MS)
}

export function isoWeekday(d: PlainDate): Weekday {
  const js = new Date(parse(d)).getUTCDay() // 0 = Sunday
  return (js === 0 ? 7 : js) as Weekday
}

export function weekStart(d: PlainDate): PlainDate {
  return addDays(d, 1 - isoWeekday(d))
}

export function daysBetween(from: PlainDate, to: PlainDate): PlainDate[] {
  const out: PlainDate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function monthGrid(year: number, month: number): PlainDate[] {
  const mm = String(month).padStart(2, '0')
  const first = `${year}-${mm}-01`
  const last = `${year}-${mm}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`
  return daysBetween(weekStart(first), addDays(weekStart(last), 6))
}
