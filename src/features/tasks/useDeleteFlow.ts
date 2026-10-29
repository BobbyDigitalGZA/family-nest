import { useState } from 'react'
import { borrarOcurrencia } from '../../data/actions'
import type { PlainDate, Task } from '../../domain/types'
import { useRunAction } from './useRunAction'

/** ✕ de la fila y botón del detalle: una de un día se borra sin preguntar; una repetida abre la elección. */
export function useDeleteFlow(task: Task, originalDate: PlainDate, onDeleted?: () => void) {
  const { run, error } = useRunAction()
  const [choosing, setChoosing] = useState(false)
  const start = () => {
    if (task.recurrence.kind === 'once') {
      void run((actorId, device) => borrarOcurrencia(task.id, originalDate, actorId, device)).then(
        (ok) => {
          if (ok) onDeleted?.()
        },
      )
    } else setChoosing(true)
  }
  return { start, error, choosing, close: () => setChoosing(false) }
}
