import { AuthGate } from './features/auth/AuthGate'
import { t } from './i18n/es'

export default function App() {
  return (
    <>
      <h1>{t('appName')}</h1>
      <AuthGate>{null}</AuthGate>
    </>
  )
}
