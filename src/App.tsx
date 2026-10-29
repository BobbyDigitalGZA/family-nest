import { useState } from 'react'
import { AuthGate } from './features/auth/AuthGate'
import { FamilyMembers } from './features/family/FamilyMembers'
import { FamilyView } from './features/family/FamilyView'
import { WallFrame } from './features/family/WallFrame'
import { useActor } from './features/identity/useActor'
import { useWallIdle } from './features/identity/useWallIdle'
import { EventLog } from './features/log/EventLog'
import { PersonalView } from './features/personal/PersonalView'
import { t } from './i18n/es'
import './features/family/family.css'

/** Vista familiar como inicio; al tocar a una persona se abre su vista (Hoy, Semana y Mes). */
function Home() {
  const [memberId, setMemberId] = useState<string | null>(null)
  const [log, setLog] = useState(false)
  const [family, setFamily] = useState(false)
  const { device, backToFamily } = useActor()
  // En la pared, cuando vence quien actúa, la pantalla también vuelve a la vista familiar.
  useWallIdle(device === 'wall', () => {
    backToFamily()
    setMemberId(null)
    setLog(false)
    setFamily(false)
  })
  if (family) return <WallFrame><FamilyMembers onBack={() => setFamily(false)} /></WallFrame>
  if (log) return <WallFrame><EventLog onBack={() => setLog(false)} /></WallFrame>
  if (memberId) return <PersonalView memberId={memberId} onBack={() => setMemberId(null)} />
  return <FamilyView onOpenMember={setMemberId} onOpenLog={() => setLog(true)} onOpenMembers={() => setFamily(true)} />
}

export default function App() {
  return (
    <>
      <h1 className="fv-sr">{t('appName')}</h1>
      <AuthGate>
        <Home />
      </AuthGate>
    </>
  )
}

