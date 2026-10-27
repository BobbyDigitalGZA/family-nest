/** Calendar date as 'YYYY-MM-DD' (no time zone attached). */
export type PlainDate = string

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type Recurrence =
  | { kind: 'once'; date: PlainDate }
  | { kind: 'weekly'; weekdays: Weekday[]; start: PlainDate; end: PlainDate | null }
  | { kind: 'monthly'; dayOfMonth: number; start: PlainDate; end: PlainDate | null }

export interface Task {
  id: string
  familyId: string
  title: string
  assigneeId: string
  createdById: string
  createdAt: string
  isHousehold: boolean
  recurrence: Recurrence
  deletedAt: string | null
}

export interface OccurrenceOverride {
  taskId: string
  occurrenceDate: PlainDate
  movedTo: PlainDate | null
  deleted: boolean
  excusedById: string | null
}

export interface Occurrence {
  taskId: string
  originalDate: PlainDate
  date: PlainDate
  excused: boolean
}

export interface Completion {
  taskId: string
  /** Keyed by the occurrence's originalDate, so a moved occurrence keeps its mark. */
  occurrenceDate: PlainDate
  completedAt: string
  completedById: string
  late: boolean
}
