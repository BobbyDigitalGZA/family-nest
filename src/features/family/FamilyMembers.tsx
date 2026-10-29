import { useState, type FormEvent } from 'react'
import { getAuth } from '../../data/client'
import { addMember, removeMember, updateMember } from '../../data/members'
import type { Member } from '../../domain/types'
import { t } from '../../i18n/es'
import { Panel } from '../../ui/Panel'
import { PALETTE_KEYS, paletteName } from '../../ui/palette'
import '../identity/features.css'
import { useActor } from '../identity/useActor'
import { useRunAction } from '../tasks/useRunAction'
import { useTasksData } from '../tasks/tasksContext'
import { asPalette } from './palette'
import './family.css'

const NICKNAME_MAX = 24

const sameNickname = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es')

/** Apodo de 1 a 24 caracteres, sin repetir el de otro miembro activo. */
function nicknameProblem(nickname: string, others: Member[]): string | null {
  const clean = nickname.trim()
  if (clean === '' || clean.length > NICKNAME_MAX) return t('errNicknameRequired')
  if (others.some((m) => sameNickname(m.nickname, clean))) return t('errNicknameDuplicate')
  return null
}

function Swatch({ color }: { color: string }) {
  return <span className="fm-swatch" aria-hidden="true" style={{ background: `var(--color-persona-${asPalette(color)})` }} />
}

function ColorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="fn-field">
      {t('colorLabel')}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {PALETTE_KEYS.map((k) => (
          <option key={k} value={k}>
            {paletteName(k)}
          </option>
        ))}
      </select>
    </label>
  )
}

type Mode = { kind: 'view' } | { kind: 'edit'; nickname: string; color: string } | { kind: 'remove' }

function MemberRow({ member, others, own, canRemove }: { member: Member; others: Member[]; own: boolean; canRemove: boolean }) {
  const { readOnly } = useTasksData()
  const { run, error, setError } = useRunAction()
  const [mode, setMode] = useState<Mode>({ kind: 'view' })
  const [busy, setBusy] = useState(false)

  async function act(fn: (actorId: string) => Promise<void>) {
    setBusy(true)
    const ok = await run((actorId) => fn(actorId))
    setBusy(false)
    if (ok) setMode({ kind: 'view' })
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (mode.kind !== 'edit') return
    const problem = nicknameProblem(mode.nickname, others)
    if (problem) {
      setError(problem)
      return
    }
    void act((actorId) => updateMember(member.id, { nickname: mode.nickname.trim(), color: mode.color }, actorId))
  }

  function cancel() {
    setError(null)
    setMode({ kind: 'view' })
  }

  return (
    <li className="fm-row" data-testid="fm-member">
      <div className="fm-line">
        <Swatch color={member.color} />
        <span className="fm-name ellipsis" title={member.nickname}>
          {member.nickname}
        </span>
        <span className="fm-state">
          {own ? t('memberYouTag') : member.authUserId ? t('memberLinked') : t('memberPending')}
        </span>
      </div>
      {error && (
        <p role="alert" className="fn-error">
          {error}
        </p>
      )}
      {mode.kind === 'view' && !readOnly && (
        <div className="fm-actions">
          <button
            type="button"
            className="fn-link"
            onClick={() => {
              setError(null)
              setMode({ kind: 'edit', nickname: member.nickname, color: asPalette(member.color) })
            }}
          >
            {t('editMember', { nickname: member.nickname })}
          </button>
          {canRemove && (
            <button type="button" className="fn-link" onClick={() => setMode({ kind: 'remove' })}>
              {t('removeMember', { nickname: member.nickname })}
            </button>
          )}
        </div>
      )}
      {mode.kind === 'edit' && (
        <form className="fm-form" onSubmit={save}>
          <label className="fn-field">
            {t('nicknameLabel')}
            <input
              value={mode.nickname}
              maxLength={NICKNAME_MAX}
              onChange={(e) => setMode({ ...mode, nickname: e.target.value })}
            />
          </label>
          <ColorSelect value={mode.color} onChange={(color) => setMode({ ...mode, color })} />
          <div className="fm-actions">
            <button type="submit" className="fn-btn" disabled={busy}>
              {t('saveMember')}
            </button>
            <button type="button" className="fn-link" onClick={cancel}>
              {t('cancel')}
            </button>
          </div>
        </form>
      )}
      {mode.kind === 'remove' && (
        <div className="fm-form">
          <p>{t(member.authUserId ? 'removeMemberAskLinked' : 'removeMemberAsk', { nickname: member.nickname })}</p>
          <div className="fm-actions">
            <button
              type="button"
              className="fn-btn"
              disabled={busy}
              onClick={() =>
                void act(async (actorId) => {
                  if (actorId === member.id) throw new Error('remove-self')
                  await removeMember(member.id, actorId)
                })
              }
            >
              {t('removeMemberYes')}
            </button>
            <button type="button" className="fn-link" onClick={cancel}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function AddMember({ members }: { members: Member[] }) {
  const { readOnly } = useTasksData()
  const { run, error, setError } = useRunAction()
  const firstFree = PALETTE_KEYS.find((k) => !members.some((m) => m.color === k)) ?? PALETTE_KEYS[0]
  const [nickname, setNickname] = useState('')
  // Sin elección propia, el color propuesto es el primero que nadie usa (se recalcula tras cada alta).
  const [picked, setPicked] = useState<string | null>(null)
  const color = picked ?? firstFree
  const [birthday, setBirthday] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = nicknameProblem(nickname, members)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    const ok = await run(async (actorId) => {
      await addMember({ nickname: nickname.trim(), color, birthday: birthday === '' ? null : birthday }, actorId)
    })
    setBusy(false)
    if (ok) {
      setNickname('')
      setBirthday('')
      setPicked(null)
    }
  }

  return (
    <Panel>
      <h3 className="fm-sub">{t('addMember')}</h3>
      {error && (
        <p role="alert" className="fn-error">
          {error}
        </p>
      )}
      <form onSubmit={(e) => void submit(e)}>
        <label className="fn-field">
          {t('nicknameLabel')}
          <input value={nickname} maxLength={NICKNAME_MAX} disabled={readOnly} onChange={(e) => setNickname(e.target.value)} />
        </label>
        <ColorSelect value={color} onChange={setPicked} />
        <label className="fn-field">
          {t('birthdayLabel')}
          <input type="date" value={birthday} disabled={readOnly} onChange={(e) => setBirthday(e.target.value)} />
        </label>
        <button type="submit" className="fn-btn" disabled={busy || readOnly}>
          {t('addMemberBtn')}
        </button>
      </form>
    </Panel>
  )
}

/** Cierra la sesión solo en este equipo; sin ella no hay forma de entrar con otra cuenta. */
function SignOut({ wall }: { wall: boolean }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const res = await getAuth().signOut({ scope: 'local' })
      if (res.error) throw new Error(res.error.message)
      // La sesión cae por onAuthStateChange y la app vuelve a «Iniciar sesión».
    } catch {
      setError(t('errSignOut'))
      setBusy(false)
    }
  }

  return (
    <Panel>
      <h3 className="fm-sub">{t('sessionTitle')}</h3>
      {error && (
        <p role="alert" className="fn-error">
          {error}
        </p>
      )}
      {asking ? (
        <div className="fm-form">
          <p>{t(wall ? 'signOutAskWall' : 'signOutAsk')}</p>
          <div className="fm-actions">
            <button type="button" className="fn-btn" disabled={busy} onClick={() => void confirm()}>
              {t('signOutYes')}
            </button>
            <button
              type="button"
              className="fn-link"
              onClick={() => {
                setError(null)
                setAsking(false)
              }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="fn-btn" onClick={() => setAsking(true)}>
          {t('signOut')}
        </button>
      )}
    </Panel>
  )
}

/** Familia: el código de unión y los miembros (agregar, cambiar apodo o color, quitar). */
export function FamilyMembers({ onBack }: { onBack: () => void }) {
  const { snapshot, readOnly } = useTasksData()
  const { device, actorId } = useActor()
  const members = snapshot.members.filter((m) => m.active)
  // En el teléfono quien actúa es siempre la persona de la cuenta.
  const ownId = device === 'phone' ? actorId : null
  const code = snapshot.family.joinCode ?? null

  return (
    <main className="fm-root">
      <header className="fm-top">
        <button type="button" className="fn-btn" onClick={onBack}>
          {t('back')}
        </button>
        <h2 className="fm-title">{t('familyTitle')}</h2>
      </header>
      <Panel>
        <h3 className="fm-sub">{t('joinCodeLabel')}</h3>
        {code ? (
          <p className="fn-code" data-testid="fm-join-code">
            {code}
          </p>
        ) : (
          <p>{t('joinCodeMissing')}</p>
        )}
        <p className="fm-hint">{t('joinCodeHow')}</p>
      </Panel>
      <Panel>
        <h3 className="fm-sub">{t('membersTitle')}</h3>
        <ul className="fm-list">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              others={members.filter((x) => x.id !== m.id)}
              own={m.id === ownId}
              canRemove={m.id !== ownId && members.length > 1}
            />
          ))}
        </ul>
      </Panel>
      <AddMember members={members} />
      {!readOnly && <SignOut wall={device === 'wall'} />}
    </main>
  )
}
