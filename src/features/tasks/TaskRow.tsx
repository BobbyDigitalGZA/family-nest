import { useState } from 'react'
import { completar, desmarcar } from '../../data/actions'
import { canMarkDone } from '../../domain/completion'
import { localTimeIn, todayIn } from '../../domain/dates'
import type { Occurrence, Task } from '../../domain/types'
import { t } from '../../i18n/es'
import { Checkbox } from '../../ui/Checkbox'
import { DeleteChoice } from './DeleteChoice'
import { TaskDetail } from './TaskDetail'
import { useTasksData } from './tasksContext'
import { useDeleteFlow } from './useDeleteFlow'
import { useRunAction } from './useRunAction'
import './tasks.css'

const TYPE_KEY = { once: 'typeOnce', weekly: 'typeWeekly', monthly: 'typeMonthly' } as const
const TYPE_ICON = { once: '•', weekly: '↻', monthly: '▦' } as const

interface TaskRowProps {
  occurrence: Occurrence
  task: Task
}

/**
 * Casilla a la izquierda (cumple), descripción que abre el detalle, ícono y leyenda de tipo,
 * «Creada por {apodo}» y ✕. En el iPhone, etiqueta y leyenda bajan a una segunda línea (CSS).
 */
export function TaskRow({ occurrence, task }: TaskRowProps) {
  const { snapshot, readOnly } = useTasksData()
  const { run, error } = useRunAction()
  const [detailOpen, setDetailOpen] = useState(false)
  const del = useDeleteFlow(task, occurrence.originalDate)

  const completion = snapshot.completions.find(
    (c) => c.taskId === task.id && c.occurrenceDate === occurrence.originalDate,
  )
  const done = completion !== undefined
  const now = new Date()
  const verdict = canMarkDone(
    occurrence.date,
    todayIn(snapshot.family.timeZone, now),
    localTimeIn(snapshot.family.timeZone, now),
    snapshot.family.lateMarkUntil,
  )
  const locked = !done && !verdict.ok
  const creator = snapshot.members.find((m) => m.id === task.createdById)?.nickname ?? t('unknownMember')

  const toggle = () =>
    void run((actorId, device) =>
      done
        ? desmarcar(task.id, occurrence.originalDate, actorId, device)
        : completar(task.id, occurrence.originalDate, actorId, device),
    )

  return (
    <li className="tk-row" data-done={done} data-locked={locked}>
      <span className="tk-check">
        <Checkbox
          checked={done}
          onToggle={toggle}
          disabled={readOnly || locked || occurrence.excused}
          ariaLabel={t('completeTask', { title: task.title })}
        />
      </span>
      <button type="button" className="tk-title" onClick={() => setDetailOpen(true)}>
        {task.title}
      </button>
      <span className="tk-meta">
        <span className="tk-type">
          <span aria-hidden="true">{TYPE_ICON[task.recurrence.kind]}</span>
          <span>{t(TYPE_KEY[task.recurrence.kind])}</span>
        </span>
        {task.isHousehold && <span className="tk-tag">{t('householdTag')}</span>}
        {occurrence.excused && <span className="tk-tag">{t('excusedTag')}</span>}
        {completion?.late && <span className="tk-tag">{t('lateTag')}</span>}
        {locked && <span className="tk-tag">{t('lockedTag')}</span>}
        <span className="tk-author">{t('createdBy', { nickname: creator })}</span>
      </span>
      <button
        type="button"
        className="tk-del"
        aria-label={t('deleteLabel')}
        disabled={readOnly}
        onClick={del.start}
      >
        <span aria-hidden="true">✕</span>
      </button>
      {(error || del.error) && (
        <p role="alert" className="fn-error tk-error">
          {error ?? del.error}
        </p>
      )}
      <TaskDetail
        taskId={task.id}
        originalDate={occurrence.originalDate}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
      <DeleteChoice
        task={task}
        originalDate={occurrence.originalDate}
        open={del.choosing}
        onClose={del.close}
      />
    </li>
  )
}
