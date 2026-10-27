import { useEffect, useState } from 'react'
import { getAuth } from '../../data/client'

/** `userId` es null sin sesión; `loading` es true hasta saber si la hay. */
export function useSession(): { userId: string | null; loading: boolean } {
  const [state, setState] = useState<{ userId: string | null; loading: boolean }>({
    userId: null,
    loading: true,
  })

  useEffect(() => {
    const auth = getAuth()
    let live = true
    void auth.getSession().then((res) => {
      if (live) setState({ userId: res.data.session?.user.id ?? null, loading: false })
    })
    const { data } = auth.onAuthStateChange((_event, session) => {
      if (live) setState({ userId: session?.user.id ?? null, loading: false })
    })
    return () => {
      live = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}
