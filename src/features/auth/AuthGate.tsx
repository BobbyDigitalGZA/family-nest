import { useEffect, useState, type ReactNode } from 'react'
import { familyExists } from '../../data/onboarding'
import { logInteraction } from '../../data/repo'
import { isDemoMode, useFamilyData } from '../../data/useFamilyData'
import { t } from '../../i18n/es'
import { Panel } from '../../ui/Panel'
import '../identity/features.css'
import { IdentityProvider } from '../identity/IdentityProvider'
import { TasksProvider } from '../tasks/TasksProvider'
import { Claim } from './Claim'
import { Setup } from './Setup'
import { SignIn } from './SignIn'
import { useSession } from './useSession'
import { WallDevice } from './WallDevice'

type Step = 'setup' | 'claim' | 'wall'

/** Sin familia: Configurar. Con familia: Unirse (con la opción de la pantalla de la casa). */
function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    familyExists().then(
      (exists) => {
        if (live) setStep(exists ? 'claim' : 'setup')
      },
      () => {
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [])

  if (failed)
    return (
      <main className="fn-screen">
        <Panel>
          <p role="alert" className="fn-error">
            {t('loadError')}
          </p>
          <button type="button" className="fn-btn" onClick={() => location.reload()}>
            {t('retry')}
          </button>
        </Panel>
      </main>
    )
  if (step === null) return <p className="fn-screen">{t('loading')}</p>
  if (step === 'setup') return <Setup onDone={onDone} />
  if (step === 'wall') return <WallDevice onDone={onDone} onBack={() => setStep('claim')} />
  return <Claim onDone={onDone} onWall={() => setStep('wall')} />
}

function Signed({ userId, children }: { userId: string; children: ReactNode }) {
  const { snapshot, error, loading, reload } = useFamilyData()
  const own = snapshot?.members.find((m) => m.authUserId === userId && m.active) ?? null

  // Cada apertura de la app con persona identificada (teléfono) queda registrada.
  const ownId = own?.id
  useEffect(() => {
    if (ownId) void logInteraction(ownId, 'phone', 'open').catch(() => {})
  }, [ownId])

  if (loading) return <p className="fn-screen">{t('loading')}</p>
  if (error && error.message === 'family-not-found') return <Onboarding onDone={() => void reload()} />
  if (error || !snapshot)
    return (
      <main className="fn-screen">
        <Panel>
          <p role="alert" className="fn-error">
            {t('loadError')}
          </p>
          <button type="button" className="fn-btn" onClick={() => void reload()}>
            {t('retry')}
          </button>
        </Panel>
      </main>
    )
  // Cuenta de miembro = teléfono; si la familia es visible sin miembro ligado, es la pantalla de la casa.
  return (
    <IdentityProvider
      device={own ? 'phone' : 'wall'}
      memberId={own?.id ?? null}
      members={snapshot.members}
    >
      <TasksProvider value={{ snapshot, reload, readOnly: isDemoMode() }}>{children}</TasksProvider>
    </IdentityProvider>
  )
}

function Authed({ children }: { children: ReactNode }) {
  const { userId, loading, error, retry } = useSession()
  if (loading) return <p className="fn-screen">{t('loading')}</p>
  if (error)
    return (
      <main className="fn-screen">
        <Panel>
          <p role="alert" className="fn-error">
            {t('errSession')}
          </p>
          <button type="button" className="fn-btn" onClick={retry}>
            {t('retry')}
          </button>
        </Panel>
      </main>
    )
  if (!userId) return <SignIn />
  return (
    <Signed key={userId} userId={userId}>
      {children}
    </Signed>
  )
}

/** Sesión → (primera configuración | reclamo | pantalla de la casa) → identidad. */
export function AuthGate({ children }: { children: ReactNode }) {
  // Solo en desarrollo: `?demo=n` usa la familia inventada, sin sesión y de solo lectura.
  if (isDemoMode()) return <Signed userId="demo">{children}</Signed>
  return <Authed>{children}</Authed>
}
