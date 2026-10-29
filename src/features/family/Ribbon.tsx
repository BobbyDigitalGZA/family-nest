import type { Member } from '../../domain/types'
import { t } from '../../i18n/es'
import { asPalette } from './palette'

interface Props {
  members: Member[]
  counts: Map<string, number>
  onOpenMember: (memberId: string) => void
}

/** Cinta con una píldora por miembro: apodo y tareas de hoy; tocarla abre su vista. */
export function Ribbon({ members, counts, onOpenMember }: Props) {
  return (
    <nav className="fv-ribbon" aria-label={t('ribbonLabel')}>
      {members.map((m) => (
        <button
          key={m.id}
          type="button"
          className="fv-pill"
          data-testid={`pill-${m.nickname}`}
          style={{ background: `var(--color-persona-${asPalette(m.color)})` }}
          onClick={() => onOpenMember(m.id)}
        >
          <span className="fv-pill-name ellipsis">{m.nickname}</span>
          <span className="fv-pill-count">{counts.get(m.id) ?? 0}</span>
        </button>
      ))}
    </nav>
  )
}
