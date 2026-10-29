import { useEffect, useState } from 'react'
import { getAuth } from '../../data/client'

/** `userId` es null sin sesión; `loading` es true hasta saber si la hay. */
interface SessionState {
  userId: string | null
  loading: boolean
  error: boolean
}

export function useSession(): SessionState & { retry: () => void } {
  const [state, setState] = useState<SessionState>({ userId: null, loading: true, error: false })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const auth = getAuth()
    let live = true
    void Promise.resolve(auth.getSession()).then(
      (res) => {
        if (!live) return
        if (res.error) setState({ userId: null, loading: false, error: true })
        else setState({ userId: res.data.session?.user.id ?? null, loading: false, error: false })
      },
      () => {
        if (live) setState({ userId: null, loading: false, error: true })
      },
    )
    const { data } = auth.onAuthStateChange((_event, session) => {
      if (live) setState({ userId: session?.user.id ?? null, loading: false, error: false })
    })
    return () => {
      live = false
      data.subscription.unsubscribe()
    }
  }, [attempt])

  const retry = () => {
    setState({ userId: null, loading: true, error: false })
    setAttempt((n) => n + 1)
  }
  return { ...state, retry }
}
