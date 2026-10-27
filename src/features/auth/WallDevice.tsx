import { useState, type FormEvent } from 'react'
import { registerWallDevice } from '../../data/onboarding'
import { t } from '../../i18n/es'
import { Panel } from '../../ui/Panel'
import '../identity/features.css'
import { errorText } from './errors'

interface WallDeviceProps {
  onDone: () => void
  onBack?: () => void
}

/** "Esta es la pantalla de la casa": liga esta cuenta a la familia como equipo de pared. */
export function WallDevice({ onDone, onBack }: WallDeviceProps) {
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (code.trim() === '') {
      setError(t('errCodeRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await registerWallDevice(code.trim(), label.trim())
      onDone()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <main className="fn-screen">
      <Panel>
        <h2 className="fn-title">{t('wallTitle')}</h2>
        {error && (
          <p role="alert" className="fn-error">
            {error}
          </p>
        )}
        <form onSubmit={(e) => void submit(e)}>
          <label className="fn-field">
            {t('joinCodeInput')}
            <input
              value={code}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className="fn-field">
            {t('wallLabelLabel')}
            <input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <button type="submit" className="fn-btn" disabled={busy}>
            {t('wallRegister')}
          </button>
          {onBack && (
            <button type="button" className="fn-link" onClick={onBack}>
              {t('back')}
            </button>
          )}
        </form>
      </Panel>
    </main>
  )
}
