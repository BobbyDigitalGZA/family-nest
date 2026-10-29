import { createContext, useContext } from 'react'
import type { FamilySnapshot } from '../../data/repo'

export interface TasksData {
  snapshot: FamilySnapshot
  /** Vuelve a leer los datos después de una acción. */
  reload: () => Promise<void> | void
  /** Modo de demostración: se ve todo, no se escribe nada. */
  readOnly: boolean
}

export const TasksContext = createContext<TasksData | null>(null)

export function useTasksData(): TasksData {
  const v = useContext(TasksContext)
  if (!v) throw new Error('useTasksData needs a TasksProvider')
  return v
}
