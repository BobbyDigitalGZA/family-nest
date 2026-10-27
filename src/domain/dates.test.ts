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
  const now = new Date('2026-10-28T04:30:00Z') // 11:30 p. m. del 27 en Lima
  expect(todayIn('America/Lima', now)).toBe('2026-10-27')
  expect(localTimeIn('America/Lima', now)).toBe('23:30')
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
test('zona con horario de verano (America/New_York): hoy y semana en los cambios de hora', () => {
  const ny = 'America/New_York'
  // Fin del horario de verano 2026: domingo 1 de noviembre, 2:00 EDT → 1:00 EST.
  expect(todayIn(ny, new Date('2026-11-01T03:30:00Z'))).toBe('2026-10-31') // 23:30 EDT del sábado
  expect(todayIn(ny, new Date('2026-11-01T04:30:00Z'))).toBe('2026-11-01') // 00:30 EDT del domingo
  expect(localTimeIn(ny, new Date('2026-11-01T05:30:00Z'))).toBe('01:30') // EDT, antes del cambio
  expect(localTimeIn(ny, new Date('2026-11-01T06:30:00Z'))).toBe('01:30') // EST: la 1:30 se repite
  // El domingo de 25 horas sigue en la semana del lunes 26; el lunes empieza a medianoche EST (05:00Z).
  const sundayLate = todayIn(ny, new Date('2026-11-02T04:30:00Z')) // 23:30 EST del domingo
  expect(sundayLate).toBe('2026-11-01')
  expect(weekStart(sundayLate)).toBe('2026-10-26')
  const mondayEarly = todayIn(ny, new Date('2026-11-02T05:30:00Z')) // 00:30 EST del lunes
  expect(mondayEarly).toBe('2026-11-02')
  expect(weekStart(mondayEarly)).toBe('2026-11-02')
  // Inicio del horario de verano 2026: domingo 8 de marzo, 2:00 EST → 3:00 EDT.
  expect(localTimeIn(ny, new Date('2026-03-08T06:59:00Z'))).toBe('01:59')
  expect(localTimeIn(ny, new Date('2026-03-08T07:00:00Z'))).toBe('03:00')
  expect(todayIn(ny, new Date('2026-03-09T03:59:00Z'))).toBe('2026-03-08') // 23:59 EDT
  expect(todayIn(ny, new Date('2026-03-09T04:00:00Z'))).toBe('2026-03-09') // 00:00 EDT del lunes
})
