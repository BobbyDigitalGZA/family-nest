import { useContext } from 'react'
import { ActorContext, type ActorApi } from './identityContext'

export function useActor(): ActorApi {
  const api = useContext(ActorContext)
  if (!api) throw new Error('useActor needs an IdentityProvider')
  return api
}
