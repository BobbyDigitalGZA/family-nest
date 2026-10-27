import type { FamilySnapshot } from '../../data/repo'
import { canMarkDone } from '../../domain/completion'
import { localTimeIn, todayIn } from '../../domain/dates'
import { occurrencesBetween } from '../../domain/recurrence'
import type { Occurrence, PlainDate, Task } from '../../domain/types'

/** pendiente → no hecho → hecho (y las excusadas al final). */
export type ItemState = 'pending' | 'missed' | 'done' | 'excused'

export interface DayItem {
  task: Task
  occurrence: Occurrence
  state: ItemState
  /** Ya no se puede marcar ni desmarcar (pasó el plazo de las 10:00 a. m. del día siguiente). */
  locked: boolean
}

const RANK: Record<ItemState, number> = { pending: 0, missed: 1, done: 2, excused: 3 }

/** Ocurrencias de una persona entre dos fechas, ya clasificadas. */
export function occurrencesOf(snapshot: FamilySnapshot, memberId: string, from: PlainDate, to: PlainDate): Occurrence[] {
  return snapshot.tasks
    .filter((x) => x.assigneeId === memberId)
    .flatMap((x) => occurrencesBetween(x, snapshot.overrides, from, to))
}

/** Las ocurrencias de la persona por día (fecha efectiva), cada día en el orden de la vista. */
export function itemsByDay(
  snapshot: FamilySnapshot,
  memberId: string,
  from: PlainDate,
  to: PlainDate,
  now: Date,
): Map<PlainDate, DayItem[]> {
  const tz = snapshot.family.timeZone
  const today = todayIn(tz, now)
  const time = localTimeIn(tz, now)
  const out = new Map<PlainDate, DayItem[]>()
  for (const x of snapshot.tasks) {
    if (x.assigneeId !== memberId) continue
    for (const occurrence of occurrencesBetween(x, snapshot.overrides, from, to)) {
      const done = snapshot.completions.some(
        (c) => c.taskId === x.id && c.occurrenceDate === occurrence.originalDate,
      )
      const verdict = canMarkDone(occurrence.date, today, time, snapshot.family.lateMarkUntil)
      const state: ItemState = done ? 'done' : occurrence.excused ? 'excused' : verdict.ok ? 'pending' : 'missed'
      const list = out.get(occurrence.date) ?? []
      list.push({ task: x, occurrence, state, locked: !verdict.ok })
      out.set(occurrence.date, list)
    }
  }
  for (const list of out.values()) {
    list.sort((a, b) => RANK[a.state] - RANK[b.state] || a.task.title.localeCompare(b.task.title, 'es'))
  }
  return out
}

export const dragId = (taskId: string, originalDate: PlainDate): string => `${taskId}|${originalDate}`
export function parseDragId(id: string | number): { taskId: string; originalDate: PlainDate } | null {
  const at = String(id).lastIndexOf('|')
  return at < 0 ? null : { taskId: String(id).slice(0, at), originalDate: String(id).slice(at + 1) }
}
export const dropId = (date: PlainDate): string => `day:${date}`
export function parseDropId(id: string | number): PlainDate | null {
  const s = String(id)
  return s.startsWith('day:') ? s.slice(4) : null
}

/** La ventana de marcar de la ocurrencia (por su día efectivo) ya cerró. */
export function isLocked(snapshot: FamilySnapshot, taskId: string, originalDate: PlainDate, now: Date): boolean {
  const tz = snapshot.family.timeZone
  const effective =
    snapshot.overrides.find((o) => o.taskId === taskId && o.occurrenceDate === originalDate)?.movedTo ?? originalDate
  return !canMarkDone(effective, todayIn(tz, now), localTimeIn(tz, now), snapshot.family.lateMarkUntil).ok
}
