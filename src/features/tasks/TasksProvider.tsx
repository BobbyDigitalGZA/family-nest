import type { ReactNode } from 'react'
import { TasksContext, type TasksData } from './tasksContext'

/** Entrega los datos de la familia a las piezas de tareas (fila, detalle, nueva tarea). */
export function TasksProvider({ value, children }: { value: TasksData; children: ReactNode }) {
  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}
