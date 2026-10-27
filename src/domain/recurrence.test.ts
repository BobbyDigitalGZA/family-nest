import { dates, task } from '../test/factories'
import {
  canMoveOccurrence,
  endSeriesFrom,
  occurrencesBetween,
  validateRecurrence,
} from './recurrence'
import type { Recurrence } from './types'

const monthly31 = task({ kind: 'monthly', dayOfMonth: 31, start: '2026-01-01', end: null })
test('el 31 cae el último día en meses cortos', () => {
  expect(dates(occurrencesBetween(monthly31, [], '2026-04-01', '2026-04-30'))).toEqual(['2026-04-30'])
  expect(dates(occurrencesBetween(monthly31, [], '2027-02-01', '2027-02-28'))).toEqual(['2027-02-28'])
  expect(dates(occurrencesBetween(monthly31, [], '2028-02-01', '2028-02-29'))).toEqual(['2028-02-29'])
})
test('semanal respeta inicio, fin y días', () => {
  const t = task({ kind: 'weekly', weekdays: [2, 4], start: '2026-10-27', end: '2026-11-05' })
  expect(dates(occurrencesBetween(t, [], '2026-10-26', '2026-11-08')))
    .toEqual(['2026-10-27', '2026-10-29', '2026-11-03', '2026-11-05'])
})
test('una ocurrencia movida sale de su día y aparece en el nuevo', () => {
  const t = task({ kind: 'weekly', weekdays: [1], start: '2026-10-26', end: null })
  const ov = [{ taskId: t.id, occurrenceDate: '2026-10-26', movedTo: '2026-10-28', deleted: false, excusedById: null }]
  expect(occurrencesBetween(t, ov, '2026-10-26', '2026-11-01'))
    .toEqual([{ taskId: t.id, originalDate: '2026-10-26', date: '2026-10-28', excused: false }])
})
test('una diaria no se mueve a un día en que ya ocurre', () => {
  const daily = task({ kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7], start: '2026-10-01', end: null })
  expect(canMoveOccurrence(daily, [], '2026-10-27', '2026-10-28')).toEqual({ ok: false, reason: 'already-occurs' })
})
test('borrar todas corta la serie y deja el pasado', () => {
  const t = task({ kind: 'weekly', weekdays: [1], start: '2026-10-05', end: null })
  expect(endSeriesFrom(t, '2026-11-02', '2026-10-27')).toEqual({ kind: 'weekly', weekdays: [1], start: '2026-10-05', end: '2026-11-01' })
  // desde la primera ocurrencia, ya pasada: corta desde hoy y conserva el pasado
  expect(endSeriesFrom(t, '2026-10-05', '2026-10-27')).toEqual({ kind: 'weekly', weekdays: [1], start: '2026-10-05', end: '2026-10-26' })
  const future = task({ kind: 'weekly', weekdays: [1], start: '2026-11-02', end: null })
  expect(endSeriesFrom(future, '2026-11-02', '2026-10-27')).toBe('delete-task')
})

describe('validateRecurrence', () => {
  const w = (over: object) =>
    ({ kind: 'weekly', weekdays: [2], start: '2026-10-01', end: null, ...over }) as Recurrence
  test('acepta las válidas', () => {
    expect(validateRecurrence({ kind: 'once', date: '2026-10-27' })).toBeNull()
    expect(validateRecurrence(w({}))).toBeNull()
    expect(validateRecurrence({ kind: 'monthly', dayOfMonth: 31, start: '2026-10-01', end: '2026-12-31' })).toBeNull()
  })
  test('rechaza lo inválido', () => {
    expect(validateRecurrence({ kind: 'once', date: '' })).toBe('date-required')
    expect(validateRecurrence(w({ start: '' }))).toBe('date-required')
    expect(validateRecurrence(w({ weekdays: [] }))).toBe('weekdays-required')
    expect(validateRecurrence({ kind: 'monthly', dayOfMonth: 0, start: '2026-10-01', end: null })).toBe('day-of-month-invalid')
    expect(validateRecurrence({ kind: 'monthly', dayOfMonth: 32, start: '2026-10-01', end: null })).toBe('day-of-month-invalid')
    expect(validateRecurrence({ kind: 'monthly', dayOfMonth: NaN, start: '2026-10-01', end: null })).toBe('day-of-month-invalid')
    expect(validateRecurrence(w({ end: '2026-09-30' }))).toBe('end-before-start')
    expect(validateRecurrence(w({ end: '' }))).toBe('date-required')
  })
})
