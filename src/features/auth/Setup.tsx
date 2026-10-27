import { useMemo, useState, type FormEvent } from 'react'
import { createFamily, saveFamilyCountry, type NewMemberInput } from '../../data/onboarding'
import { t } from '../../i18n/es'
import { Panel } from '../../ui/Panel'
import { PALETTE_KEYS, paletteName } from '../../ui/palette'
import '../identity/features.css'
import { browserTimeZone, countryOptions, timeZoneOptions } from './countries'
import { errorText } from './errors'

interface DraftMember {
  key: number
  nickname: string
  color: string
  birthday: string
}

const draft = (key: number): DraftMember => ({
  key,
  nickname: '',
  color: PALETTE_KEYS[key % PALETTE_KEYS.length]!,
  birthday: '',
})

interface SetupProps {
  onDone: () => void
  onBack?: () => void
}

/** Primera configuración: nombre, zona horaria, país de los festivos y cualquier número de miembros. */
export function Setup({ onDone, onBack }: SetupProps) {
  const [name, setName] = useState('')
  const [timeZone, setTimeZone] = useState(browserTimeZone())
  const [country, setCountry] = useState('')
  const [members, setMembers] = useState<DraftMember[]>([draft(0)])
  const [nextKey, setNextKey] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [countrySaved, setCountrySaved] = useState(true)

  const countries = useMemo(() => countryOptions(), [])
  const zones = useMemo(() => timeZoneOptions(browserTimeZone()), [])

  function patch(key: number, change: Partial<DraftMember>) {
    setMembers((list) => list.map((m) => (m.key === key ? { ...m, ...change } : m)))
  }

  function validate(): string | null {
    if (name.trim() === '') return t('errNameRequired')
    if (timeZone === '') return t('errTimeZoneRequired')
    if (country === '') return t('errCountryRequired')
    if (members.length === 0) return t('errMembersRequired')
    if (members.some((m) => m.nickname.trim() === '' || m.nickname.trim().length > 24))
      return t('errNicknameRequired')
    return null
  }

  async function saveCountry(): Promise<boolean> {
    try {
      await saveFamilyCountry(country)
      setCountrySaved(true)
      return true
    } catch {
      setCountrySaved(false)
      return false
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const input: NewMemberInput[] = members.map((m) => ({
        nickname: m.nickname.trim(),
        color: m.color,
        birthday: m.birthday === '' ? null : m.birthday,
      }))
      const joinCode = await createFamily({
        name: name.trim(),
        timeZone,
        countryCode: country,
        members: input,
      })
      setCode(joinCode)
      await saveCountry()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function retryCountry() {
    setBusy(true)
    await saveCountry()
    setBusy(false)
  }

  if (code !== null) {
    return (
      <main className="fn-screen">
        <Panel>
          <h2 className="fn-title">{t('joinCodeTitle')}</h2>
          <p>{t('joinCodeIntro')}</p>
          <p>
            {t('joinCodeLabel')}: <span className="fn-code" data-testid="join-code">{code}</span>
          </p>
          {!countrySaved && (
            <p role="alert" className="fn-error">
              {t('countryNotSaved')}{' '}
              <button type="button" className="fn-link" disabled={busy} onClick={() => void retryCountry()}>
                {t('retrySaveCountry')}
              </button>
            </p>
          )}
          <button type="button" className="fn-btn" onClick={onDone}>
            {t('continue')}
          </button>
        </Panel>
      </main>
    )
  }

  return (
    <main className="fn-screen">
      <Panel>
        <h2 className="fn-title">{t('setupTitle')}</h2>
        {error && (
          <p role="alert" className="fn-error">
            {error}
          </p>
        )}
        <form onSubmit={(e) => void submit(e)}>
          <label className="fn-field">
            {t('familyNameLabel')}
            <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="fn-field">
            {t('timeZoneLabel')}
            <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <label className="fn-field">
            {t('countryLabel')}
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">{t('countryPlaceholder')}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <h3>{t('membersTitle')}</h3>
          {members.map((m, i) => (
            <fieldset key={m.key} className="fn-member">
              <legend>{t('memberN', { n: i + 1 })}</legend>
              <label className="fn-field">
                {t('nicknameLabel')}
                <input
                  value={m.nickname}
                  maxLength={24}
                  onChange={(e) => patch(m.key, { nickname: e.target.value })}
                />
              </label>
              <label className="fn-field">
                {t('colorLabel')}
                <select value={m.color} onChange={(e) => patch(m.key, { color: e.target.value })}>
                  {PALETTE_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {paletteName(k)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fn-field">
                {t('birthdayLabel')}
                <input
                  type="date"
                  value={m.birthday}
                  onChange={(e) => patch(m.key, { birthday: e.target.value })}
                />
              </label>
              {members.length > 1 && (
                <button
                  type="button"
                  className="fn-link"
                  onClick={() => setMembers((list) => list.filter((x) => x.key !== m.key))}
                >
                  {m.nickname.trim() ? t('removeMember', { nickname: m.nickname.trim() }) : t('removeMemberBlank', { n: i + 1 })}
                </button>
              )}
            </fieldset>
          ))}
          <p>
            <button
              type="button"
              className="fn-btn"
              onClick={() => {
                setMembers((list) => [...list, draft(nextKey)])
                setNextKey(nextKey + 1)
              }}
            >
              {t('addMember')}
            </button>
          </p>
          <button type="submit" className="fn-btn" disabled={busy}>
            {t('createFamily')}
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
