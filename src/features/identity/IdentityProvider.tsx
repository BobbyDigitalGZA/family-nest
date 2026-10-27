import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import type { Device } from '../../data/repo'
import { identityReducer, type IdentityState } from '../../domain/identity'
import type { Member } from '../../domain/types'
import { ActorContext, type ActorApi } from './identityContext'
import { WhoAreYou } from './WhoAreYou'

interface IdentityProviderProps {
  device: Device
  members: Member[]
  /** Con cuenta de miembro (teléfono): el miembro ligado a la cuenta. */
  memberId?: string | null
  children: ReactNode
}

interface Waiter {
  resolve(id: string): void
  reject(e: Error): void
}

const TICK_MS = 1000
const INITIAL: IdentityState = { actorId: null, lastActivityAt: 0 }

export function IdentityProvider({ device, members, memberId = null, children }: IdentityProviderProps) {
  const [state, dispatch] = useReducer(identityReducer, INITIAL)
  const [asking, setAsking] = useState(false)
  const waiters = useRef<Waiter[]>([])
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const wall = device === 'wall'

  // La pared caduca al actor a los 90 s; cualquier toque o tecla cuenta como actividad.
  useEffect(() => {
    if (!wall) return
    const tick = window.setInterval(() => dispatch({ type: 'tick', now: Date.now() }), TICK_MS)
    const activity = () => dispatch({ type: 'activity', now: Date.now() })
    document.addEventListener('pointerdown', activity)
    document.addEventListener('keydown', activity)
    return () => {
      window.clearInterval(tick)
      document.removeEventListener('pointerdown', activity)
      document.removeEventListener('keydown', activity)
    }
  }, [wall])

  const requireActor = useCallback((): Promise<string> => {
    if (!wall) {
      return memberId ? Promise.resolve(memberId) : Promise.reject(new Error('not-a-member'))
    }
    const current = stateRef.current.actorId
    if (current) {
      dispatch({ type: 'activity', now: Date.now() })
      return Promise.resolve(current)
    }
    return new Promise<string>((resolve, reject) => {
      waiters.current.push({ resolve, reject })
      setAsking(true)
    })
  }, [wall, memberId])

  const choose = useCallback((id: string) => {
    dispatch({ type: 'choose', memberId: id, now: Date.now() })
    const pending = waiters.current
    waiters.current = []
    setAsking(false)
    pending.forEach((w) => w.resolve(id))
  }, [])

  const cancel = useCallback(() => {
    const pending = waiters.current
    waiters.current = []
    setAsking(false)
    pending.forEach((w) => w.reject(new Error('identity-cancelled')))
  }, [])

  const backToFamily = useCallback(() => dispatch({ type: 'backToFamily' }), [])

  const api = useMemo<ActorApi>(
    () => ({
      actorId: wall ? state.actorId : memberId,
      requireActor,
      backToFamily,
      device,
    }),
    [wall, state.actorId, memberId, requireActor, backToFamily, device],
  )

  return (
    <ActorContext.Provider value={api}>
      {children}
      {wall && <WhoAreYou open={asking} members={members} onChoose={choose} onCancel={cancel} />}
    </ActorContext.Provider>
  )
}
