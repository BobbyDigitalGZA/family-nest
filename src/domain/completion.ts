import { t } from '../i18n/es'
import { addDays } from './dates'
import type { Completion, Occurrence, PlainDate } from './types'

export interface Compliance {
  done: number
  total: number
  percent: number
}

export function compliance(occ: Occurrence[], done: Completion[]): Compliance {
  const counted = occ.filter((x) => !x.excused)
  const total = counted.length
  const doneCount = counted.filter((x) =>
    done.some(
      (d) => d.taskId === x.taskId && d.occurrenceDate === x.originalDate,
    ),
  ).length
  return {
    done: doneCount,
    total,
    percent: total === 0 ? 0 : Math.round((doneCount / total) * 100),
  }
}

export function formatCompliance(c: Compliance): string {
  if (c.total === 0) return t('noTasks')
  return t('complianceText', {
    percent: c.percent,
    done: c.done,
    total: c.total,
  })
}

export function canMarkDone(
  occurrenceDate: PlainDate,
  today: PlainDate,
  localTime: string,
  lateUntil: string,
): { ok: true; late: boolean } | { ok: false } {
  if (occurrenceDate >= today) return { ok: true, late: false }
  if (occurrenceDate === addDays(today, -1) && localTime < lateUntil) {
    return { ok: true, late: true }
  }
  return { ok: false }
}
