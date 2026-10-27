import {
  addDays,
  isoWeekday,
  lastDayOfMonth,
  localTimeIn,
  monthGrid,
  todayIn,
  weekStart,
} from './dates'

test('hoy usa la zona de la familia, no UTC', () => {
  const now = new Date('2026-10-28T04:30:00Z') // 11:30 p. m. del 27 en Bogotá
  expect(todayIn('America/Bogota', now)).toBe('2026-10-27')
  expect(localTimeIn('America/Bogota', now)).toBe('23:30')
})
test('la semana empieza el lunes', () => {
  expect(weekStart('2026-11-01')).toBe('2026-10-26') // domingo → lunes anterior
  expect(isoWeekday('2026-10-26')).toBe(1)
})
test('último día del mes, con bisiesto', () => {
  expect(lastDayOfMonth(2027, 2)).toBe(28)
  expect(lastDayOfMonth(2028, 2)).toBe(29)
})
test('cuadrícula del mes en semanas completas', () => {
  const g = monthGrid(2026, 11)
  expect(g[0]).toBe('2026-10-26')
  expect(g.length % 7).toBe(0)
  expect(g.at(-1)).toBe('2026-12-06')
})
test('addDays cruza fin de año', () =>
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01'))
