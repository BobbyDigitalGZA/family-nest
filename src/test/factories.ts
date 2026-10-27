import type { FamilySnapshot } from '../data/repo'
import type { Completion, Family, Member, Occurrence, PlainDate, Recurrence, Task, Weekday } from '../domain/types'

export function task(recurrence: Recurrence, patch: Partial<Task> = {}): Task {
  return {
    id: 't1',
    familyId: 'f1',
    title: 'Sacar la basura',
    assigneeId: 'm1',
    createdById: 'm1',
    createdAt: '2026-10-01T12:00:00Z',
    isHousehold: false,
    recurrence,
    deletedAt: null,
    ...patch,
  }
}

export function dates(occ: Occurrence[]): PlainDate[] {
  return occ.map((x) => x.date)
}

export function o(taskId: string, date: PlainDate): Occurrence {
  return { taskId, originalDate: date, date, excused: false }
}

export function c(taskId: string, date: PlainDate): Completion {
  return {
    taskId,
    occurrenceDate: date,
    completedAt: '2026-10-27T12:00:00Z',
    completedById: 'm1',
    late: false,
  }
}

export const testFamily: Family = {
  id: 'f1',
  name: 'Familia de prueba',
  timeZone: 'America/Bogota',
  lateMarkUntil: '10:00',
}

export function member(id: string, nickname: string, patch: Partial<Member> = {}): Member {
  return {
    id,
    familyId: 'f1',
    nickname,
    color: 'blue',
    birthday: null,
    sortOrder: 0,
    authUserId: null,
    active: true,
    ...patch,
  }
}

/** Invented family used by the data-layer tests. */
export function testSnapshot(): FamilySnapshot {
  const weekdays: Weekday[] = [1, 2, 3, 4, 5]
  const ana = (id: string, recurrence: Recurrence) =>
    task(recurrence, { id, assigneeId: 'm-Ana', createdById: 'm-Ana' })
  return {
    family: testFamily,
    members: [
      member('m1', 'Mamá'),
      member('m-Ana', 'Ana', { sortOrder: 1 }),
      member('m-Leo', 'Leo', { sortOrder: 2 }),
      member('m-Sol', 'Sol', { sortOrder: 3 }),
      member('m-Tomi', 'Tomi', { sortOrder: 4, active: false }),
    ],
    tasks: [
      task({ kind: 'once', date: '2026-10-26' }, { id: 't-ayer-de-Leo', assigneeId: 'm-Leo' }),
      ana('t-ana-diaria', { kind: 'weekly', weekdays, start: '2026-10-01', end: null }),
      ana('t-ana-sab', { kind: 'weekly', weekdays: [6], start: '2026-10-01', end: null }),
      ana('t-ana-uno', { kind: 'once', date: '2026-10-28' }),
      ana('t-ana-dos', { kind: 'once', date: '2026-10-30' }),
      task({ kind: 'once', date: '2026-10-27' }, { id: 't-hoy-de-Sol', assigneeId: 'm-Sol' }),
    ],
    overrides: [],
    completions: [
      c('t-ana-diaria', '2026-10-26'),
      c('t-ana-diaria', '2026-10-27'),
      c('t-ana-diaria', '2026-10-28'),
      c('t-ana-uno', '2026-10-28'),
      c('t-ana-dos', '2026-10-30'),
    ],
  }
}
