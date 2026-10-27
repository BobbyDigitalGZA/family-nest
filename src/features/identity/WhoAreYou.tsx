import type { Member } from '../../domain/types'
import { t } from '../../i18n/es'
import { Sheet } from '../../ui/Sheet'
import './features.css'

interface WhoAreYouProps {
  open: boolean
  members: Member[]
  onChoose: (memberId: string) => void
  onCancel: () => void
}

/** Lista a todos los miembros activos, sin límite; solo se ve el apodo. */
export function WhoAreYou({ open, members, onChoose, onCancel }: WhoAreYouProps) {
  const options = members.filter((m) => m.active).sort((a, b) => a.sortOrder - b.sortOrder)
  return (
    <Sheet open={open} onClose={onCancel} title={t('whoAreYou')}>
      <h2 className="fn-title">{t('whoAreYou')}</h2>
      <div className="fn-options">
        {options.map((m) => (
          <button
            key={m.id}
            type="button"
            data-testid="who-option"
            className="fn-option"
            style={{ background: `var(--color-persona-${m.color}, var(--color-persona-blue))` }}
            onClick={() => onChoose(m.id)}
          >
            {m.nickname}
          </button>
        ))}
      </div>
      <button type="button" className="fn-link" onClick={onCancel}>
        {t('cancel')}
      </button>
    </Sheet>
  )
}
