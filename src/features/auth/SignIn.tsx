import { useState, type FormEvent } from 'react'
import { getAuth } from '../../data/client'
import { t } from '../../i18n/es'
import { Panel } from '../../ui/Panel'
import '../identity/features.css'

/** Correo → código de 6 dígitos. Al verificar, la sesión llega por onAuthStateChange. */
export function SignIn() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    const address = email.trim()
    setBusy(true)
    setError(null)
    try {
      const res = await getAuth().signInWithOtp({ email: address })
      if (res.error) setError(t('errSendCode'))
      else setSentTo(address)
    } catch {
      setError(t('errSendCode'))
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    if (!sentTo) return
    setBusy(true)
    setError(null)
    try {
      const res = await getAuth().verifyOtp({ email: sentTo, token: token.trim(), type: 'email' })
      if (res.error) setError(t('errVerifyCode'))
    } catch {
      setError(t('errVerifyCode'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="fn-screen">
      <Panel>
        <h2 className="fn-title">{t('signInTitle')}</h2>
        {error && (
          <p role="alert" className="fn-error">
            {error}
          </p>
        )}
        {sentTo === null ? (
          <form onSubmit={(e) => void sendCode(e)}>
            <label className="fn-field">
              {t('emailLabel')}
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button type="submit" className="fn-btn" disabled={busy || email.trim() === ''}>
              {t('sendCode')}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void verify(e)}>
            <p>{t('codeSentTo', { email: sentTo })}</p>
            <label className="fn-field">
              {t('otpLabel')}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
            <button type="submit" className="fn-btn" disabled={busy || !/^[0-9]{6}$/.test(token.trim())}>
              {t('verifyCode')}
            </button>
            <button
              type="button"
              className="fn-link"
              onClick={() => {
                setSentTo(null)
                setToken('')
                setError(null)
              }}
            >
              {t('useOtherEmail')}
            </button>
          </form>
        )}
      </Panel>
    </main>
  )
}
