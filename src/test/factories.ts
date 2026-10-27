import type { Occurrence, PlainDate, Recurrence, Task } from '../domain/types'

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
