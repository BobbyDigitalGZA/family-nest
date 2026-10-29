import { compliance, formatCompliance } from '../../domain/completion'
import type { Completion, Occurrence } from '../../domain/types'
import { t } from '../../i18n/es'
import type { PaletteKey } from '../../ui/palette'
import { ProgressBar } from '../../ui/ProgressBar'

interface Props {
  nickname: string
  color: PaletteKey
  occurrences: Occurrence[]
  completions: Completion[]
}

/** Siempre con el número de tareas: `50 % · 1 de 2`. */
export function ComplianceWidget({ nickname, color, occurrences, completions }: Props) {
  const c = compliance(occurrences, completions)
  return (
    <div className="fv-compliance" data-testid={`compliance-${nickname}`}>
      <span className="fv-compliance-text">{formatCompliance(c)}</span>
      <ProgressBar value={c.percent} color={color} ariaLabel={t('complianceLabel', { nickname })} />
    </div>
  )
}
