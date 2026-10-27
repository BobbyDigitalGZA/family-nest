import { useState } from 'react'
import { AuthGate } from './features/auth/AuthGate'
import { FamilyView } from './features/family/FamilyView'
import { PersonalView } from './features/personal/PersonalView'
import { t } from './i18n/es'
import './features/family/family.css'

/** Vista familiar como inicio; al tocar a una persona se abre su vista (Hoy, Semana y Mes). */
function Home() {
  const [memberId, setMemberId] = useState<string | null>(null)
  if (memberId) return <PersonalView memberId={memberId} onBack={() => setMemberId(null)} />
  return <FamilyView onOpenMember={setMemberId} />
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

