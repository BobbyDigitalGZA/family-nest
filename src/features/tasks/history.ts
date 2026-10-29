import type { EventRow } from '../../data/repo'
import type { Member } from '../../domain/types'
import { t } from '../../i18n/es'
import { formatDate } from './format'

/** Texto del historial de una tarea; solo apodos. Devuelve null para eventos que no son de tareas. */
export function eventText(e: EventRow, members: Member[]): string | null {
  const nick = (id: unknown) =>
    members.find((m) => m.id === id)?.nickname ?? t('unknownMember')
  const nickname = nick(e.actorId)
  const p = e.payload
  switch (e.type) {
    case 'created':
      return t('evCreated', { nickname })
    case 'assigned':
      return p.from === p.to
        ? t('evHousehold', { nickname })
        : t('evAssigned', { nickname, to: nick(p.to) })
    case 'renamed':
      return t('evRenamed', { nickname })
    case 'recurrence_changed':
      return t('evRecurrence', { nickname })
    case 'moved':
      return t('evMoved', { nickname, date: typeof p.to === 'string' ? formatDate(p.to) : '' })
    case 'completed':
      return t(p.late === true ? 'evCompletedLate' : 'evCompleted', { nickname })
    case 'uncompleted':
      return t('evUncompleted', { nickname })
    case 'deleted_occurrence':
      return t('evDeletedOcc', { nickname })
    case 'deleted_series':
      return t('evDeletedSeries', { nickname })
    case 'excused':
      return t('evExcused', { nickname })
    default:
      return null
  }
}
