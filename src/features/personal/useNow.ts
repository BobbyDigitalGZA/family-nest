import { useEffect, useState } from 'react'

const MINUTE = 60_000

/** La hora de ahora, renovada cada minuto: los candados (10:00 a. m.) cambian sin otro motivo para dibujar. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), MINUTE)
    return () => window.clearInterval(id)
  }, [])
  return now
}
