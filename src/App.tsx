import { useState } from 'react'
import { AuthGate } from './features/auth/AuthGate'
import { FamilyView } from './features/family/FamilyView'
import { t } from './i18n/es'
import './features/family/family.css'

/** Vista familiar como inicio; la vista personal (Tarea 12) se abre con el miembro elegido. */
function Home() {
  const [, setMemberId] = useState<string | null>(null)
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

