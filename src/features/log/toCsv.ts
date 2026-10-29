import type { EventRow } from '../../data/repo'
import { localTimeIn, todayIn, weekStart } from '../../domain/dates'
import type { EventType } from '../../domain/events'
import type { Member, PlainDate } from '../../domain/types'
import { t, type TKey } from '../../i18n/es'

export interface WeekCounts {
  memberId: string
  created: number
  assigned: number
  completed: number
  moved: number
}

const COUNTED = ['created', 'assigned', 'completed', 'moved'] as const

export function eventLabel(type: EventType): string {
  return t(`event.${type}` as TKey)
}

/** Week (Monday date) an event belongs to, in the family time zone. */
export function weekOfEvent(at: string, timeZone: string): PlainDate {
  return weekStart(todayIn(timeZone, new Date(at)))
}

export function weeklySummary(
  events: EventRow[],
  start: PlainDate,
  timeZone: string,
  members: Member[] = [],
): WeekCounts[] {
  const byMember = new Map<string, WeekCounts>()
  for (const e of events) {
    if (!(COUNTED as readonly string[]).includes(e.type)) continue
    if (weekOfEvent(e.at, timeZone) !== start) continue
    let row = byMember.get(e.actorId)
    if (!row) {
      row = { memberId: e.actorId, created: 0, assigned: 0, completed: 0, moved: 0 }
      byMember.set(e.actorId, row)
    }
    row[e.type as (typeof COUNTED)[number]] += 1
  }
  const order = new Map(members.map((m, i) => [m.id, [m.sortOrder, i] as const]))
  return [...byMember.values()].sort((a, b) => {
    const oa = order.get(a.memberId)
    const ob = order.get(b.memberId)
    if (oa && ob) return oa[0] - ob[0] || oa[1] - ob[1]
    if (oa) return -1
    if (ob) return 1
    return a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0
  })
}

/** RFC 4180 quoting, plus a leading quote on cells a spreadsheet would run as a formula. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(events: EventRow[], members: Member[], timeZone: string): string {
  const nick = new Map(members.map((m) => [m.id, m.nickname] as const))
  const lines = [t('logHeader')]
  for (const e of events) {
    const when = new Date(e.at)
    const payload = Object.keys(e.payload).length === 0 ? '' : JSON.stringify(e.payload)
    lines.push(
      [
        todayIn(timeZone, when),
        localTimeIn(timeZone, when),
        nick.get(e.actorId) ?? t('logUnknownActor'),
        eventLabel(e.type),
        e.taskTitle ?? '',
        e.occurrenceDate ?? '',
        t(`device.${e.device}` as TKey),
        payload,
      ]
        .map(cell)
        .join(','),
    )
  }
  return lines.join('\n')
}

