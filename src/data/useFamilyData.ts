import { useCallback, useEffect, useRef, useState } from 'react'
import { subscribeFamily } from './realtime'
import { loadFamilySnapshot, type FamilySnapshot } from './repo'

/** Dev only: `?demo=4` or `?demo=9` swaps Supabase for an in-memory invented family. */
function demoSize(): number | null {
  if (!import.meta.env.DEV) return null
  const n = Number(new URLSearchParams(window.location.search).get('demo'))
  return n > 0 ? n : null
}

export const isDemoMode = (): boolean => demoSize() !== null

async function load(): Promise<FamilySnapshot> {
  const demo = demoSize()
  if (demo !== null) {
    const { demoSnapshot } = await import('./fixtures')
    return demoSnapshot(demo)
  }
  return loadFamilySnapshot()
}

export function useFamilyData() {
  const [snapshot, setSnapshot] = useState<FamilySnapshot | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Reloads can overlap (an action, realtime, a rejoin): a response older than the last one
  // applied is dropped, and nothing lands after unmount.
  const latest = useRef(0)
  const applied = useRef(0)
  const mounted = useRef(true)

  const reload = useCallback(() => {
    const seq = ++latest.current
    return load().then(
      (s) => {
        if (!mounted.current || seq < applied.current) return
        applied.current = seq
        setSnapshot(s)
        setError(null)
      },
      (e: unknown) => {
        if (!mounted.current || seq < applied.current) return
        applied.current = seq
        setError(e instanceof Error ? e : new Error(String(e)))
      },
    )
  }, [])

  useEffect(() => {
    mounted.current = true
    void reload()
    const off = demoSize() === null ? subscribeFamily(() => void reload()) : null
    return () => {
      mounted.current = false
      off?.()
    }
  }, [reload])

  return { snapshot, error, loading: snapshot === null && error === null, reload }
}
