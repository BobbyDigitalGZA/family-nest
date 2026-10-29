import { canMarkDone, compliance, formatCompliance } from '../domain/completion'
import { addDays, lastDayOfMonth, localTimeIn, todayIn, weekStart } from '../domain/dates'
import { occurrencesBetween, validateRecurrence } from '../domain/recurrence'
import type { Occurrence, PlainDate, Recurrence, Task } from '../domain/types'
import {
  completeOccurrence,
  createTask,
  deleteOccurrence,
  deleteSeriesFrom,
  loadFamilySnapshot,
  moveOccurrence,
  uncompleteOccurrence,
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
  const title = input.title.trim()
  if (title === '') throw new Error('title-required')
  const problem = validateRecurrence(input.recurrence)
  if (problem) throw new Error(problem)
  await createTask({ ...input, title }, actorId, device)
}

/** La ventana de marcar de un día: hoy (o después), o ayer antes de family.late_mark_until. */
function dayWindow(s: FamilySnapshot, day: PlainDate) {
  const now = new Date()
  return canMarkDone(
    day,
    todayIn(s.family.timeZone, now),
    localTimeIn(s.family.timeZone, now),
    s.family.lateMarkUntil,
  )
}

/** Marcar, desmarcar, mover y borrar una ocurrencia comparten ventana: la de su día efectivo. */
function markWindow(s: FamilySnapshot, taskId: string, occurrenceDate: PlainDate) {
  const effectiveDate =
    s.overrides.find((ov) => ov.taskId === taskId && ov.occurrenceDate === occurrenceDate)?.movedTo ??
    occurrenceDate
  return dayWindow(s, effectiveDate)
}

function findTask(s: FamilySnapshot, taskId: string): Task {
  const task = s.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error('task-not-found')
  return task
}

/** Una tarea de un día cuya ventana cerró ya no cambia de persona ni de repetición. */
function assertSeriesEditable(s: FamilySnapshot, task: Task) {
  if (task.recurrence.kind === 'once' && !markWindow(s, task.id, task.recurrence.date).ok) {
    throw new Error('locked')
  }
}

/**
 * Devuelve el id de la tarea que lleva la serie desde hoy. Si la tarea repetida ya tuvo
 * ocurrencias antes de hoy, el servidor la parte: la vieja termina ayer y la copia es otra tarea.
 */
export async function asignar(
  taskId: string,
  memberId: string,
  actorId: string,
  device: Device,
): Promise<string> {
  const s = await assertFamilyMember(actorId)
  assertSeriesEditable(s, findTask(s, taskId))
  return updateTask(taskId, { assigneeId: memberId }, actorId, device)
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
  const verdict = markWindow(s, taskId, occurrenceDate)
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

export async function renombrar(taskId: string, title: string, actorId: string, device: Device) {
  await assertFamilyMember(actorId)
  const clean = title.trim()
  if (clean === '') throw new Error('title-required')
  await updateTask(taskId, { title: clean }, actorId, device)
}

/** Cambia la repetición (una vez <-> semanal / mensual) desde hoy; devuelve el id como asignar. */
export async function cambiarCuandoToca(
  taskId: string,
  recurrence: Recurrence,
  actorId: string,
  device: Device,
): Promise<string> {
  const s = await assertFamilyMember(actorId)
  const problem = validateRecurrence(recurrence)
  if (problem) throw new Error(problem)
  assertSeriesEditable(s, findTask(s, taskId))
  return updateTask(taskId, { recurrence }, actorId, device)
}

export async function desmarcar(
  taskId: string,
  occurrenceDate: PlainDate,
  actorId: string,
  device: Device,
) {
  const s = await assertFamilyMember(actorId)
  if (!s.tasks.some((t) => t.id === taskId)) throw new Error('task-not-found')
  if (!markWindow(s, taskId, occurrenceDate).ok) throw new Error('locked')
  await uncompleteOccurrence(taskId, occurrenceDate, actorId, device)
}

/**
 * Mueve solo esa ocurrencia; lanza 'locked' / 'same-date' / 'past-target' / 'already-occurs'
 * sin llamar a la RPC.
 */
export async function mover(
  taskId: string,
  originalDate: PlainDate,
  target: PlainDate,
  actorId: string,
  device: Device,
) {
  const s = await assertFamilyMember(actorId)
  const task = s.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error('task-not-found')
  // Una ocurrencia cuya ventana de marcar cerró no se mueve (si no, se adelantaría y se marcaría sin «tarde»).
  if (!markWindow(s, taskId, originalDate).ok) throw new Error('locked')
  // Y no se mueve a un día cuya ventana ya cerró: quedaría atrapada como no hecha.
  const current = s.overrides.find((ov) => ov.taskId === taskId && ov.occurrenceDate === originalDate)?.movedTo ?? originalDate
  if (target !== current && !dayWindow(s, target).ok) throw new Error('past-target')
  await moveOccurrence(task, s.overrides, originalDate, target, actorId, device)
}

export async function borrarOcurrencia(
  taskId: string,
  occurrenceDate: PlainDate,
  actorId: string,
  device: Device,
) {
  const s = await assertFamilyMember(actorId)
  findTask(s, taskId)
  // "Solo esta" sigue la misma ventana que marcar: lo vencido no se borra (sí se puede excusar).
  if (!markWindow(s, taskId, occurrenceDate).ok) throw new Error('locked')
  await deleteOccurrence(taskId, occurrenceDate, actorId, device)
}

/** "Todas": corta la serie desde esa ocurrencia; borra la tarea solo si no tiene pasado. */
export async function borrarSerie(
  taskId: string,
  occurrenceDate: PlainDate,
  actorId: string,
  device: Device,
) {
  const s = await assertFamilyMember(actorId)
  const task = s.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error('task-not-found')
  await deleteSeriesFrom(task, occurrenceDate, todayIn(s.family.timeZone, new Date()), actorId, device)
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
