import { useEffect, useState } from 'react'
import { todayIn } from '../../domain/dates'
import type { PlainDate } from '../../domain/types'

const MINUTE = 60_000

/** "Hoy" en la zona de la familia; se renueva cada minuto (cruza la medianoche sin recargar). */
export function useToday(timeZone: string): PlainDate {
  const [today, setToday] = useState(() => todayIn(timeZone, new Date()))
  useEffect(() => {
    const tick = () => setToday(todayIn(timeZone, new Date()))
    tick()
    const id = window.setInterval(tick, MINUTE)
    return () => window.clearInterval(id)
  }, [timeZone])
  return today
}
