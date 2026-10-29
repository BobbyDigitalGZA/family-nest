import type { PlainDate } from '../../domain/types'

/**
 * Cuando el servidor parte una serie (reasignar o cambiar la repetición con pasado), la
 * ocurrencia abierta pasa a otra tarea y su fila se vuelve a montar con otra clave. Este
 * aviso de corta vida le dice a la fila nueva que abra su detalle, para que el detalle siga
 * a la tarea nueva en vez de cerrarse.
 */
const TTL_MS = 5000
let pending: { taskId: string; originalDate: PlainDate; until: number } | null = null

export function followDetail(taskId: string, originalDate: PlainDate): void {
  pending = { taskId, originalDate, until: Date.now() + TTL_MS }
}

/** Sin efectos: se puede llamar desde un inicializador de estado. */
export function isFollowed(taskId: string, originalDate: PlainDate): boolean {
  return (
    pending !== null &&
    pending.until > Date.now() &&
    pending.taskId === taskId &&
    pending.originalDate === originalDate
  )
}

export function clearFollow(taskId: string, originalDate: PlainDate): void {
  if (pending?.taskId === taskId && pending.originalDate === originalDate) pending = null
}
