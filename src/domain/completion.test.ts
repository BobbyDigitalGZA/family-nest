import { c, o } from '../test/factories'
import { canMarkDone, compliance, formatCompliance } from './completion'

test('formato siempre con el número de tareas', () => {
  expect(formatCompliance({ done: 1, total: 2, percent: 50 })).toBe('50 % · 1 de 2')
  expect(formatCompliance({ done: 0, total: 0, percent: 0 })).toBe('Sin tareas')
})
test('las excusadas no cuentan', () => {
  const occ = [o('a', '2026-10-27'), { ...o('b', '2026-10-27'), excused: true }]
  expect(compliance(occ, [])).toEqual({ done: 0, total: 1, percent: 0 })
})
test('una ocurrencia movida conserva su marca', () => {
  const moved = { taskId: 'a', originalDate: '2026-10-26', date: '2026-10-28', excused: false }
  expect(compliance([moved], [c('a', '2026-10-26')]).done).toBe(1)
})
test('marcar tarde: hasta las 10:00 del día siguiente', () => {
  expect(canMarkDone('2026-10-26', '2026-10-27', '09:59', '10:00')).toEqual({ ok: true, late: true })
  expect(canMarkDone('2026-10-26', '2026-10-27', '10:00', '10:00')).toEqual({ ok: false })
  expect(canMarkDone('2026-10-25', '2026-10-27', '08:00', '10:00')).toEqual({ ok: false })
  expect(canMarkDone('2026-10-28', '2026-10-27', '08:00', '10:00')).toEqual({ ok: true, late: false })
})
