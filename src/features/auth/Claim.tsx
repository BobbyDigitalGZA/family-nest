import { useState, type FormEvent } from 'react'
import { claimMember, listClaimableMembers, type ClaimableMember } from '../../data/onboarding'
import { t } from '../../i18n/es'
import { Panel } from '../../ui/Panel'
import '../identity/features.css'
import { errorText } from './errors'

interface ClaimProps {
  onDone: () => void
  onBack?: () => void
  /** Abre "Esta es la pantalla de la casa". */
  onWall?: () => void
}

/** Código de unión → apodos libres → elegir el propio. */
export function Claim({ onDone, onBack, onWall }: ClaimProps) {
  const [code, setCode] = useState('')
  const [options, setOptions] = useState<ClaimableMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function find(e: FormEvent) {
    e.preventDefault()
    if (code.trim() === '') {
      setError(t('errCodeRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      setOptions(await listClaimableMembers(code.trim()))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function pick(id: string) {
    setBusy(true)
    setError(null)
    try {
      await claimMember(id, code.trim())
      onDone()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <main className="fn-screen">
      <Panel>
        <h2 className="fn-title">{t('claimTitle')}</h2>
        {error && (
          <p role="alert" className="fn-error">
            {error}
          </p>
        )}
        <form onSubmit={(e) => void find(e)}>
          <label className="fn-field">
            {t('joinCodeInput')}
            <input
              value={code}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => {
                setCode(e.target.value)
                setOptions(null)
              }}
            />
          </label>
          <button type="submit" className="fn-btn" disabled={busy}>
            {t('findMembers')}
          </button>
        </form>
        {options !== null &&
          (options.length === 0 ? (
            <p>{t('claimNone')}</p>
          ) : (
            <>
              <p>{t('claimPick')}</p>
              <div className="fn-options">
                {options.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="fn-option"
                    data-testid="claim-option"
                    disabled={busy}
                    style={{ background: `var(--color-persona-${m.color}, var(--color-persona-blue))` }}
                    onClick={() => void pick(m.id)}
                  >
                    {m.nickname}
                  </button>
                ))}
              </div>
            </>
          ))}
        {onWall && (
          <p>
            {t('claimWallHint')}{' '}
            <button type="button" className="fn-link" onClick={onWall}>
              {t('onboardingWall')}
            </button>
          </p>
        )}
        {onBack && (
          <button type="button" className="fn-link" onClick={onBack}>
            {t('back')}
          </button>
        )}
      </Panel>
    </main>
  )
}
