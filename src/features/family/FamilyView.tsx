import { useEffect, useMemo, useState } from 'react'
import { familyColumns } from '../../domain/layout'
import { occurrencesBetween } from '../../domain/recurrence'
import type { Occurrence, Task } from '../../domain/types'
import { t } from '../../i18n/es'
import { Panel } from '../../ui/Panel'
import { useActor } from '../identity/useActor'
import { NewTaskSheet } from '../tasks/NewTaskSheet'
import { TaskRow } from '../tasks/TaskRow'
import { useTasksData } from '../tasks/tasksContext'
import { ComplianceWidget } from './ComplianceWidget'
import { useWallOrientation } from './orientationContext'
import { asPalette } from './palette'
import { Ribbon } from './Ribbon'
import { useToday } from './useToday'
import { WallFrame } from './WallFrame'
import './family.css'

function Columns({ onOpenMember, onOpenLog }: { onOpenMember: (id: string) => void; onOpenLog?: () => void }) {
  const { snapshot, readOnly } = useTasksData()
  const orientation = useWallOrientation()
  const today = useToday(snapshot.family.timeZone)
  const [creating, setCreating] = useState(false)

  const members = useMemo(() => snapshot.members.filter((m) => m.active), [snapshot.members])
  const byMember = useMemo(() => {
    const taskById = new Map(snapshot.tasks.map((x) => [x.id, x] as const))
    const out = new Map<string, { task: Task; occurrence: Occurrence }[]>()
    for (const m of members) {
      const rows = snapshot.tasks
        .filter((x) => x.assigneeId === m.id)
        .flatMap((x) => occurrencesBetween(x, snapshot.overrides, today, today))
        .flatMap((occurrence) => {
          const task = taskById.get(occurrence.taskId)
          return task ? [{ task, occurrence }] : []
        })
      out.set(m.id, rows)
    }
    return out
  }, [members, snapshot.tasks, snapshot.overrides, today])

  const counts = new Map([...byMember].map(([id, rows]) => [id, rows.length] as const))
  const cols = Math.max(1, familyColumns(members.length, orientation))

  return (
    <main className="fv-root">
      <header className="fv-top">
        <Ribbon members={members} counts={counts} onOpenMember={onOpenMember} />
        {onOpenLog && (
          <button type="button" className="fn-btn" onClick={onOpenLog}>
            {t('logOpen')}
          </button>
        )}
        <button type="button" className="fn-btn fv-new" disabled={readOnly} onClick={() => setCreating(true)}>
          {t('newTask')}
        </button>
      </header>
      <div className="fv-grid" data-testid="family-grid" style={{ ['--cols' as string]: String(cols) }}>
        {members.map((m) => {
          const rows = byMember.get(m.id) ?? []
          return (
            <Panel key={m.id} className="fv-column">
              <div data-testid="member-column" className="fv-column-in">
                <h2
                  className="fv-name ellipsis"
                  data-testid="nickname"
                  title={m.nickname}
                  style={{ background: `var(--color-persona-${asPalette(m.color)})` }}
                >
                  {m.nickname}
                </h2>
                <ComplianceWidget
                  nickname={m.nickname}
                  color={asPalette(m.color)}
                  occurrences={rows.map((r) => r.occurrence)}
                  completions={snapshot.completions}
                />
                <ul className="fv-tasks">
                  {rows.map(({ task, occurrence }) => (
                    <TaskRow key={`${task.id}:${occurrence.originalDate}`} task={task} occurrence={occurrence} />
                  ))}
                </ul>
              </div>
            </Panel>
          )
        })}
      </div>
      <NewTaskSheet open={creating} onClose={() => setCreating(false)} defaultDate={today} />
    </main>
  )
}

/** Vista familiar: una columna por miembro con sus tareas de hoy y su cumplimiento. */
export function FamilyView({ onOpenMember, onOpenLog }: { onOpenMember: (memberId: string) => void; onOpenLog?: () => void }) {
  const { backToFamily } = useActor()
  // Volver a la vista familiar termina a la persona elegida.
  useEffect(() => {
    backToFamily()
  }, [backToFamily])
  return (
    <WallFrame>
      <Columns onOpenMember={onOpenMember} onOpenLog={onOpenLog} />
    </WallFrame>
  )
}
