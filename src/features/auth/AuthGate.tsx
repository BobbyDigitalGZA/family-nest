import { useEffect, useState, type ReactNode } from 'react'
import { logInteraction } from '../../data/repo'
import { isDemoMode, useFamilyData } from '../../data/useFamilyData'
import { t } from '../../i18n/es'
import { Panel } from '../../ui/Panel'
import '../identity/features.css'
import { IdentityProvider } from '../identity/IdentityProvider'
import { Claim } from './Claim'
import { Setup } from './Setup'
import { SignIn } from './SignIn'
import { useSession } from './useSession'
import { WallDevice } from './WallDevice'

type Step = 'choose' | 'setup' | 'claim' | 'wall'

function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('choose')
  const back = () => setStep('choose')
  if (step === 'setup') return <Setup onDone={onDone} onBack={back} />
  if (step === 'claim') return <Claim onDone={onDone} onBack={back} />
  if (step === 'wall') return <WallDevice onDone={onDone} onBack={back} />
  return (
    <main className="fn-screen">
      <Panel>
        <h2 className="fn-title">{t('onboardingTitle')}</h2>
        <div className="fn-options">
          <button type="button" className="fn-btn" onClick={() => setStep('setup')}>
            {t('onboardingSetup')}
          </button>
          <button type="button" className="fn-btn" onClick={() => setStep('claim')}>
            {t('onboardingClaim')}
          </button>
          <button type="button" className="fn-btn" onClick={() => setStep('wall')}>
            {t('onboardingWall')}
          </button>
        </div>
      </Panel>
    </main>
  )
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
      {children}
    </IdentityProvider>
  )
}

function Authed({ children }: { children: ReactNode }) {
  const { userId, loading } = useSession()
  if (loading) return <p className="fn-screen">{t('loading')}</p>
  if (!userId) return <SignIn />
  return <Signed userId={userId}>{children}</Signed>
}

/** Sesión → (primera configuración | reclamo | pantalla de la casa) → identidad. */
export function AuthGate({ children }: { children: ReactNode }) {
  // Solo en desarrollo: `?demo=n` usa la familia inventada, sin sesión y de solo lectura.
  if (isDemoMode()) return <Signed userId="demo">{children}</Signed>
  return <Authed>{children}</Authed>
}
