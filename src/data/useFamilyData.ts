import { useCallback, useEffect, useState } from 'react'
import { subscribeFamily } from './realtime'
import { loadFamilySnapshot, type FamilySnapshot } from './repo'

/** Dev only: `?demo=4` or `?demo=9` swaps Supabase for an in-memory invented family. */
function demoSize(): number | null {
  if (!import.meta.env.DEV) return null
  const n = Number(new URLSearchParams(window.location.search).get('demo'))
  return n > 0 ? n : null
}

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

  const reload = useCallback(
    () =>
      load().then(
        (s) => {
          setSnapshot(s)
          setError(null)
        },
        (e: unknown) => setError(e instanceof Error ? e : new Error(String(e))),
      ),
    [],
  )

  useEffect(() => {
    void reload()
    if (demoSize() !== null) return
    return subscribeFamily(() => void reload())
  }, [reload])

  return { snapshot, error, loading: snapshot === null && error === null, reload }
}
