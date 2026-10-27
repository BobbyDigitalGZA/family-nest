import { useState } from 'react'
import { borrarOcurrencia, borrarSerie } from '../../data/actions'
import type { PlainDate, Task } from '../../domain/types'
import { t } from '../../i18n/es'
import { Sheet } from '../../ui/Sheet'
import { useTasksData } from './tasksContext'
import { useRunAction } from './useRunAction'

interface DeleteChoiceProps {
  task: Task
  originalDate: PlainDate
  open: boolean
  onClose: () => void
  onDeleted?: () => void
}

/** Una repetida siempre pregunta: solo esa ocurrencia, o todas (corta la serie desde ahí). */
export function DeleteChoice({ task, originalDate, open, onClose, onDeleted }: DeleteChoiceProps) {
  const { readOnly } = useTasksData()
  const { run, error } = useRunAction()
  const [busy, setBusy] = useState(false)

  const choose = async (fn: typeof borrarOcurrencia) => {
    setBusy(true)
    const ok = await run((actorId, device) => fn(task.id, originalDate, actorId, device))
    setBusy(false)
    if (ok) {
      onClose()
      onDeleted?.()
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('deleteTitle')}>
      <h2 className="fn-title">{t('deleteTitle')}</h2>
      <p>{task.title}</p>
      {error && (
        <p role="alert" className="fn-error">
          {error}
        </p>
      )}
      <div className="tk-actions">
        <button
          type="button"
          className="fn-btn"
          disabled={readOnly || busy}
          onClick={() => void choose(borrarOcurrencia)}
        >
          {t('deleteOnlyThis')}
        </button>
        <button
          type="button"
          className="fn-btn"
          disabled={readOnly || busy}
          onClick={() => void choose(borrarSerie)}
        >
          {t('deleteAll')}
        </button>
        <button type="button" className="fn-link" onClick={onClose}>
          {t('cancel')}
        </button>
      </div>
      <p className="tk-hint">{t('deleteAllHint')}</p>
    </Sheet>
  )
}
