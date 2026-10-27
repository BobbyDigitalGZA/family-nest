import { useEffect, useState } from 'react'

/** iPhone: menos de 700 px de ancho. */
export const PHONE_MAX = 700

const measure = (): boolean => window.innerWidth < PHONE_MAX

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(measure)
  useEffect(() => {
    const update = () => setPhone(measure())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
  return phone
}
