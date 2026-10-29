import type { EventType } from '../domain/events'
import { canMoveOccurrence, endSeriesFrom } from '../domain/recurrence'
import type {
  Completion,
  Family,
  Member,
  OccurrenceOverride,
  PlainDate,
  Recurrence,
  Task,
} from '../domain/types'
import { getClient, type QueryLike, type QueryResult } from './client'
import {
  completionFromRow,
  familyFromRow,
  memberFromRow,
  overrideFromRow,
  recurrenceToColumns,
  taskFromRow,
  type Row,
} from './mappers'

export type Device = 'wall' | 'phone'

export interface FamilySnapshot {
  family: Family
  members: Member[]
  tasks: Task[]
  overrides: OccurrenceOverride[]
  completions: Completion[]
}

export interface EventRow {
  id: number
  at: string
  actorId: string
  type: EventType
  taskId: string | null
  taskTitle: string | null
  occurrenceDate: PlainDate | null
  device: Device
  payload: Record<string, unknown>
}

export interface NewTaskInput {
  title: string
  assigneeId: string
  isHousehold: boolean
  recurrence: Recurrence
}

function unwrap(res: QueryResult): unknown {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/**
 * PostgREST answers at most max_rows rows (1000 on Supabase) and truncates silently, so every
 * read is paged with a stable order. PAGE must not exceed the server's max_rows: a short page
 * is how the loop knows it reached the end.
 */
export const PAGE = 1000

async function allPages(make: () => QueryLike): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const page = (unwrap(await make().range(from, from + PAGE - 1)) as Row[] | null) ?? []
    out.push(...page)
    if (page.length < PAGE) return out
  }
}

/** Primary key of each table read whole: a stable order for paging. */
const ORDER: Record<string, string[]> = {
  family: ['id'],
  member: ['id'],
  task: ['id'],
  occurrence_override: ['task_id', 'occurrence_date'],
  completion: ['task_id', 'occurrence_date'],
}

function rows(table: string, columns = '*'): Promise<Row[]> {
  const order = ORDER[table]
  if (!order) throw new Error(`no-order-for-${table}`)
  return allPages(() =>
    order.reduce((q, col) => q.order(col, { ascending: true }), getClient().from(table).select(columns)),
  )
}

export async function loadFamilySnapshot(): Promise<FamilySnapshot> {
  const [family, members, tasks, overrides, completions] = await Promise.all([
    rows('family'),
    rows('member'),
    rows('task'),
    rows('occurrence_override'),
    rows('completion'),
  ])
  const first = family[0]
  if (!first) throw new Error('family-not-found')
  return {
    family: familyFromRow(first),
    members: members.map(memberFromRow).sort((a, b) => a.sortOrder - b.sortOrder),
    tasks: tasks.map(taskFromRow),
    overrides: overrides.map(overrideFromRow),
    completions: completions.map(completionFromRow),
  }
}

export async function loadEvents(filter?: {
  memberId?: string
  type?: EventType
  taskId?: string
  /** Timestamp bounds (ISO, from inclusive, to exclusive) applied in the query. */
  from?: string
  to?: string
}): Promise<EventRow[]> {
  const query = () => {
    let q = getClient().from('event_log').select('*')
    if (filter?.memberId) q = q.eq('actor_id', filter.memberId)
    if (filter?.type) q = q.eq('type', filter.type)
    if (filter?.taskId) q = q.eq('task_id', filter.taskId)
    if (filter?.from) q = q.gte('at', filter.from)
    if (filter?.to) q = q.lt('at', filter.to)
    return q.order('id', { ascending: false })
  }
  const [events, tasks] = await Promise.all([allPages(query), rows('task', 'id,title')])
  const titles = new Map(tasks.map((r) => [String(r.id), String(r.title)] as const))
  // An event written between two pages shifts the offsets: the same row may come twice.
  const seen = new Set<number>()
  return events.filter((r) => !seen.has(Number(r.id)) && seen.add(Number(r.id))).map((r) => {
    const taskId = r.task_id == null ? null : String(r.task_id)
    return {
      id: Number(r.id),
      at: String(r.at),
      actorId: String(r.actor_id),
      type: r.type as EventType,
      taskId,
      taskTitle: taskId === null ? null : (titles.get(taskId) ?? null),
      occurrenceDate: r.occurrence_date == null ? null : String(r.occurrence_date),
      device: r.device as Device,
      payload: (r.payload as Record<string, unknown> | null) ?? {},
    }
  })
}

/**
 * History of a task, following the series it was split from (payload.split_from). The cut
 * event of each predecessor (payload.split_to) is left out: the split shows once, on the copy.
 */
export async function loadTaskHistory(taskId: string): Promise<EventRow[]> {
  const out: EventRow[] = []
  const seen = new Set<string>()
  let next: string | null = taskId
  while (next !== null && !seen.has(next) && seen.size < 20) {
    const current: string = next
    seen.add(current)
    const rows = await loadEvents({ taskId: current })
    out.push(...(current === taskId ? rows : rows.filter((e) => e.payload.split_to === undefined)))
    const from = rows.find((e) => typeof e.payload.split_from === 'string')?.payload.split_from
    next = typeof from === 'string' ? from : null
  }
  return out.sort((a, b) => b.id - a.id)
}

async function call(fn: string, args: Record<string, unknown>): Promise<void> {
  unwrap(await getClient().rpc(fn, args))
}

const who = (actorId: string, device: Device) => ({ p_actor: actorId, p_device: device })

function taskPayload(p: Partial<NewTaskInput>): Row {
  const out: Row = {}
  if (p.title !== undefined) out.title = p.title
  if (p.assigneeId !== undefined) out.assignee_id = p.assigneeId
  if (p.isHousehold !== undefined) out.is_household = p.isHousehold
  if (p.recurrence !== undefined) Object.assign(out, recurrenceToColumns(p.recurrence))
  return out
}

export function createTask(input: NewTaskInput, actorId: string, device: Device) {
  return call('rpc_create_task', { p_task: taskPayload(input), ...who(actorId, device) })
}

/** Devuelve el id de la tarea que lleva la serie desde hoy (otro si el servidor la partió). */
export async function updateTask(
  id: string,
  patch: Partial<NewTaskInput>,
  actorId: string,
  device: Device,
): Promise<string> {
  const data = unwrap(
    await getClient().rpc('rpc_update_task', {
      p_task_id: id,
      p_patch: taskPayload(patch),
      ...who(actorId, device),
    }),
  )
  return typeof data === 'string' && data !== '' ? data : id
}

export function completeOccurrence(
  taskId: string,
  occurrenceDate: PlainDate,
  actorId: string,
  device: Device,
  late: boolean,
  forOther: boolean,
) {
  return call('rpc_complete', {
    p_task_id: taskId,
    p_date: occurrenceDate,
    p_late: late,
    p_for_other: forOther,
    ...who(actorId, device),
  })
}

export function uncompleteOccurrence(
  taskId: string,
  occurrenceDate: PlainDate,
  actorId: string,
  device: Device,
) {
  return call('rpc_uncomplete', {
    p_task_id: taskId,
    p_date: occurrenceDate,
    ...who(actorId, device),
  })
}

/** Throws the reason ('already-occurs' / 'same-date') without calling the RPC. */
export async function moveOccurrence(
  task: Task,
  overrides: OccurrenceOverride[],
  originalDate: PlainDate,
  target: PlainDate,
  actorId: string,
  device: Device,
): Promise<void> {
  const check = canMoveOccurrence(task, overrides, originalDate, target)
  if (!check.ok) throw new Error(check.reason)
  await call('rpc_move', {
    p_task_id: task.id,
    p_date: originalDate,
    p_target: target,
    ...who(actorId, device),
  })
}

export function deleteOccurrence(
  taskId: string,
  occurrenceDate: PlainDate,
  actorId: string,
  device: Device,
) {
  return call('rpc_delete_occurrence', {
    p_task_id: taskId,
    p_date: occurrenceDate,
    ...who(actorId, device),
  })
}

export function excuseOccurrence(
  taskId: string,
  occurrenceDate: PlainDate,
  actorId: string,
  device: Device,
) {
  return call('rpc_excuse', {
    p_task_id: taskId,
    p_date: occurrenceDate,
    ...who(actorId, device),
  })
}

export function deleteSeriesFrom(
  task: Task,
  occurrenceDate: PlainDate,
  today: PlainDate,
  actorId: string,
  device: Device,
) {
  const next = endSeriesFrom(task, occurrenceDate, today)
  return call('rpc_end_series', {
    p_task_id: task.id,
    p_new_rule: next === 'delete-task' ? null : recurrenceToColumns(next),
    ...who(actorId, device),
  })
}

const familyOfMember = new Map<string, string>()

/** Feeds the "when does each person use the app" data; `interaction` allows direct inserts. */
export async function logInteraction(
  memberId: string,
  device: Device,
  kind: 'open' | 'action',
): Promise<void> {
  let familyId = familyOfMember.get(memberId)
  if (!familyId) {
    const res = unwrap(
      await getClient().from('member').select('family_id').eq('id', memberId),
    ) as Row[] | null
    const found = res?.[0]?.family_id
    if (found == null) throw new Error('not-a-member')
    familyId = String(found)
    familyOfMember.set(memberId, familyId)
  }
  unwrap(
    await getClient()
      .from('interaction')
      .insert({ family_id: familyId, member_id: memberId, device, kind }),
  )
}
