import type { Recurrence } from '../domain/types'
import { describe, expect, test } from 'vitest'
import { c, member, task } from '../test/factories'
import {
  completionFromRow,
  completionToRow,
  familyFromRow,
  memberFromRow,
  memberToRow,
  overrideFromRow,
  overrideToRow,
  taskFromRow,
  taskToRow,
} from './mappers'

describe('task mapping', () => {
  test.each<[string, Recurrence]>([
    ['once', { kind: 'once', date: '2026-10-28' }],
    ['weekly', { kind: 'weekly', weekdays: [1, 3, 5], start: '2026-10-01', end: '2026-12-31' }],
    ['weekly sin fin', { kind: 'weekly', weekdays: [7], start: '2026-10-01', end: null }],
    ['monthly', { kind: 'monthly', dayOfMonth: 31, start: '2026-10-01', end: null }],
  ])('ida y vuelta: %s', (_n, recurrence) => {
    const t = task(recurrence, { isHousehold: true, deletedAt: '2026-10-27T10:00:00Z' })
    expect(taskFromRow(taskToRow(t))).toEqual(t)
  })

  test('las columnas de otra regla quedan en null', () => {
    const row = taskToRow(task({ kind: 'once', date: '2026-10-28' }))
    expect(row).toMatchObject({
      rule: 'once',
      due_date: '2026-10-28',
      weekdays: null,
      month_day: null,
      start_date: null,
      end_date: null,
    })
  })

  test('regla desconocida falla', () => {
    const row = { ...taskToRow(task({ kind: 'once', date: '2026-10-28' })), rule: 'daily' }
    expect(() => taskFromRow(row)).toThrow('unknown-rule')
  })
})

test('member round-trip, sin nombre completo ni rol', () => {
  const m = member('m-Ana', 'Ana', { birthday: '2015-03-02', authUserId: 'u1' })
  expect(memberFromRow(memberToRow(m))).toEqual(m)
  expect(Object.keys(memberToRow(m))).not.toContain('role')
})

test('override round-trip', () => {
  const ov = {
    taskId: 't1',
    occurrenceDate: '2026-10-27',
    movedTo: '2026-10-29',
    deleted: false,
    excusedById: 'm1',
  }
  expect(overrideFromRow(overrideToRow(ov, 'f1'))).toEqual(ov)
})

test('completion round-trip', () => {
  const x = { ...c('t1', '2026-10-27'), late: true }
  expect(completionFromRow(completionToRow(x, 'f1'))).toEqual(x)
})

test('family: la hora de marcar tarde llega como HH:MM', () => {
  const f = familyFromRow({
    id: 'f1',
    name: 'X',
    time_zone: 'America/Lima',
    late_mark_until: '10:00:00',
  })
  expect(f.lateMarkUntil).toBe('10:00')
})
