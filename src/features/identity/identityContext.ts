import { createContext } from 'react'
import type { Device } from '../../data/repo'

export interface ActorApi {
  actorId: string | null
  /** Resuelve con la persona que actúa; si no hay, abre "¿Quién eres?". Rechaza si se cierra sin elegir. */
  requireActor(): Promise<string>
  /** Vuelve a la vista familiar: nadie actúa hasta elegir de nuevo. */
  backToFamily(): void
  device: Device
}

export const ActorContext = createContext<ActorApi | null>(null)
