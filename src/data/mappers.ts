import type {
  Completion,
  Family,
  Member,
  OccurrenceOverride,
  Recurrence,
  Task,
  Weekday,
} from '../domain/types'

export type Row = Record<string, unknown>

const str = (v: unknown): string => String(v)
const strOrNull = (v: unknown): string | null => (v == null ? null : String(v))

export function recurrenceToColumns(r: Recurrence): Row {
  const base = {
    due_date: null,
    weekdays: null,
    month_day: null,
    start_date: null,
    end_date: null,
  }
  switch (r.kind) {
    case 'once':
      return { ...base, rule: 'once', due_date: r.date }
    case 'weekly':
      return {
        ...base,
        rule: 'weekly',
        weekdays: r.weekdays,
        start_date: r.start,
        end_date: r.end,
      }
    case 'monthly':
      return {
        ...base,
        rule: 'monthly',
        month_day: r.dayOfMonth,
        start_date: r.start,
        end_date: r.end,
      }
  }
}

export function recurrenceFromRow(row: Row): Recurrence {
  switch (row.rule) {
    case 'once':
      return { kind: 'once', date: str(row.due_date) }
    case 'weekly':
      return {
        kind: 'weekly',
        weekdays: (row.weekdays as number[]).map(Number) as Weekday[],
        start: str(row.start_date),
        end: strOrNull(row.end_date),
      }
    case 'monthly':
      return {
        kind: 'monthly',
        dayOfMonth: Number(row.month_day),
        start: str(row.start_date),
        end: strOrNull(row.end_date),
      }
    default:
      throw new Error(`unknown-rule:${String(row.rule)}`)
  }
}

export function taskFromRow(row: Row): Task {
  return {
    id: str(row.id),
    familyId: str(row.family_id),
    title: str(row.title),
    assigneeId: str(row.assignee_id),
    createdById: str(row.created_by_id),
    createdAt: str(row.created_at),
    isHousehold: Boolean(row.is_household),
    recurrence: recurrenceFromRow(row),
    deletedAt: strOrNull(row.deleted_at),
  }
}

export function taskToRow(t: Task): Row {
  return {
    id: t.id,
    family_id: t.familyId,
    title: t.title,
    assignee_id: t.assigneeId,
    created_by_id: t.createdById,
    created_at: t.createdAt,
    is_household: t.isHousehold,
    ...recurrenceToColumns(t.recurrence),
    deleted_at: t.deletedAt,
  }
}

export function memberFromRow(row: Row): Member {
  return {
    id: str(row.id),
    familyId: str(row.family_id),
    nickname: str(row.nickname),
    color: str(row.color),
    birthday: strOrNull(row.birthday),
    sortOrder: Number(row.sort_order ?? 0),
    authUserId: strOrNull(row.auth_user_id),
    active: row.active == null ? true : Boolean(row.active),
  }
}

export function memberToRow(m: Member): Row {
  return {
    id: m.id,
    family_id: m.familyId,
    nickname: m.nickname,
    color: m.color,
    birthday: m.birthday,
    sort_order: m.sortOrder,
    auth_user_id: m.authUserId,
    active: m.active,
  }
}

export function overrideFromRow(row: Row): OccurrenceOverride {
  return {
    taskId: str(row.task_id),
    occurrenceDate: str(row.occurrence_date),
    movedTo: strOrNull(row.moved_to),
    deleted: Boolean(row.deleted),
    excusedById: strOrNull(row.excused_by_id),
  }
}

export function overrideToRow(o: OccurrenceOverride, familyId: string): Row {
  return {
    task_id: o.taskId,
    occurrence_date: o.occurrenceDate,
    family_id: familyId,
    moved_to: o.movedTo,
    deleted: o.deleted,
    excused_by_id: o.excusedById,
  }
}

export function completionFromRow(row: Row): Completion {
  return {
    taskId: str(row.task_id),
    occurrenceDate: str(row.occurrence_date),
    completedAt: str(row.completed_at),
    completedById: str(row.completed_by_id),
    late: Boolean(row.late),
  }
}

export function completionToRow(c: Completion, familyId: string): Row {
  return {
    task_id: c.taskId,
    occurrence_date: c.occurrenceDate,
    family_id: familyId,
    completed_at: c.completedAt,
    completed_by_id: c.completedById,
    late: c.late,
  }
}

export function familyFromRow(row: Row): Family {
  return {
    id: str(row.id),
    name: str(row.name),
    timeZone: str(row.time_zone),
    // Postgres `time` comes back as 'HH:MM:SS'.
    lateMarkUntil: str(row.late_mark_until ?? '10:00').slice(0, 5),
    joinCode: strOrNull(row.join_code),
  }
}
