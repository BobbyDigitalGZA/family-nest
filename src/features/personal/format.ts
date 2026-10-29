import type { PlainDate } from '../../domain/types'

const utc = (d: PlainDate): Date => {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, day))
}
const fmt = (d: PlainDate, o: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat('es', { timeZone: 'UTC', ...o }).format(utc(d))

/** «27 de octubre» */
export const formatDayMonth = (d: PlainDate): string => fmt(d, { day: 'numeric', month: 'long' })
/** «martes, 27 de octubre» */
export const formatDayLong = (d: PlainDate): string => fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })
/** «octubre de 2026» */
export const formatMonthTitle = (d: PlainDate): string => fmt(d, { month: 'long', year: 'numeric' })
/** «lun» */
export const formatWeekdayShort = (d: PlainDate): string => fmt(d, { weekday: 'short' }).replace('.', '')
/** «lunes» */
export const formatWeekdayLong = (d: PlainDate): string => fmt(d, { weekday: 'long' })
/** «26 oct» */
export const formatShort = (d: PlainDate): string => fmt(d, { day: 'numeric', month: 'short' }).replace('.', '')
