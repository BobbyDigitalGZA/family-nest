import { canMarkDone, compliance, formatCompliance } from '../domain/completion'
import { addDays, lastDayOfMonth, localTimeIn, todayIn, weekStart } from '../domain/dates'
import { occurrencesBetween } from '../domain/recurrence'
import type { Occurrence, PlainDate } from '../domain/types'
import {
  completeOccurrence,
  createTask,
  loadFamilySnapshot,
  updateTask,
  type Device,
  type FamilySnapshot,
  type NewTaskInput,
} from './repo'

// The five Family Hub actions live here. The UI uses them and the Phase 2 MCP
// server will expose them as they are.

type SnapshotSource = () => Promise<FamilySnapshot>
let source: SnapshotSource | null = null

export function setSnapshotSourceForTests(s: SnapshotSource | null): void {
  source = s
}

const snapshot = (): Promise<FamilySnapshot> => (source ?? loadFamilySnapshot)()

/** In this phase everyone in the family may do everything; outsiders and inactive members may not. */
export async function assertFamilyMember(
  actorId: string,
  snap?: FamilySnapshot,
): Promise<FamilySnapshot> {
  const s = snap ?? (await snapshot())
  if (!s.members.some((m) => m.id === actorId && m.active)) throw new Error('not-a-member')
  return s
}

export async function crearTarea(input: NewTaskInput, actorId: string, device: Device) {
  await assertFamilyMember(actorId)
  await createTask(input, actorId, device)
}

export async function asignar(taskId: string, memberId: string, actorId: string, device: Device) {
  await assertFamilyMember(actorId)
  await updateTask(taskId, { assigneeId: memberId }, actorId, device)
}

export async function completar(
  taskId: string,
  occurrenceDate: PlainDate,
  actorId: string,
  device: Device,
) {
  const s = await assertFamilyMember(actorId)
  const task = s.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error('task-not-found')
  const now = new Date()
  // The cutoff applies to the day the occurrence actually falls on (moved_to if moved).
  const effectiveDate =
    s.overrides.find((ov) => ov.taskId === taskId && ov.occurrenceDate === occurrenceDate)?.movedTo ??
    occurrenceDate
  const verdict = canMarkDone(
    effectiveDate,
    todayIn(s.family.timeZone, now),
    localTimeIn(s.family.timeZone, now),
    s.family.lateMarkUntil,
  )
  if (!verdict.ok) throw new Error('locked')
  await completeOccurrence(
    taskId,
    occurrenceDate,
    actorId,
    device,
    verdict.late,
    task.assigneeId !== actorId,
  )
}

function occurrencesFor(
  s: FamilySnapshot,
  memberId: string | null,
  from: PlainDate,
  to: PlainDate,
): Occurrence[] {
  return s.tasks
    .filter((t) => memberId === null || t.assigneeId === memberId)
    .flatMap((t) => occurrencesBetween(t, s.overrides, from, to))
}

/** `null` = the whole family. "Today" is the date in the family time zone. */
export async function tareasDeHoy(memberId: string | null, now: Date): Promise<Occurrence[]> {
  const s = await snapshot()
  const today = todayIn(s.family.timeZone, now)
  return occurrencesFor(s, memberId, today, today)
}

export type ComplianceRange = 'day' | 'week' | 'month'

export async function cumplimiento(
  memberId: string,
  range: ComplianceRange,
  anchor: PlainDate,
): Promise<{ done: number; total: number; percent: number; text: string }> {
  const s = await snapshot()
  let from = anchor
  let to = anchor
  if (range === 'week') {
    from = weekStart(anchor)
    to = addDays(from, 6)
  } else if (range === 'month') {
    const [y, m] = anchor.split('-').map(Number) as [number, number]
    const mm = String(m).padStart(2, '0')
    from = `${y}-${mm}-01`
    to = `${y}-${mm}-${String(lastDayOfMonth(y, m)).padStart(2, '0')}`
  }
  const c = compliance(occurrencesFor(s, memberId, from, to), s.completions)
  return { ...c, text: formatCompliance(c) }
}
