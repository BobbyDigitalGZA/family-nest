import { todayIn } from '../../domain/dates'
import type { PlainDate } from '../../domain/types'

export function formatDate(d: PlainDate): string {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number]
  return new Intl.DateTimeFormat('es', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, day)))
}

/** Fecha (en la zona de la familia) de un instante ISO. */
export function dateOfInstant(iso: string, timeZone: string): PlainDate {
  return todayIn(timeZone, new Date(iso))
}

export function formatInstant(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es', {
    timeZone,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}
