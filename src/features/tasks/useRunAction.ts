import { useCallback, useState } from 'react'
import type { Device } from '../../data/repo'
import { errorText } from '../auth/errors'
import { useActor } from '../identity/useActor'
import { useTasksData } from './tasksContext'

/**
 * Toda acción pasa primero por requireActor(). Si se cierra "¿Quién eres?" sin elegir, no pasa
 * nada y no se muestra error; cualquier otro fallo se traduce y se muestra.
 */
export function useRunAction() {
  const { requireActor, device } = useActor()
  const { reload } = useTasksData()
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (fn: (actorId: string, device: Device) => Promise<void>): Promise<boolean> => {
      setError(null)
      try {
        const actorId = await requireActor()
        await fn(actorId, device)
        await reload()
        return true
      } catch (e) {
        if (e instanceof Error && e.message === 'identity-cancelled') return false
        setError(errorText(e))
        return false
      }
    },
    [requireActor, device, reload],
  )

  return { run, error, setError }
}
