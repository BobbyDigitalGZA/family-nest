export type EventType =
  | 'created'
  | 'assigned'
  | 'renamed'
  | 'recurrence_changed'
  | 'moved'
  | 'completed'
  | 'uncompleted'
  | 'deleted_occurrence'
  | 'deleted_series'
  | 'excused'
  | 'day_off_set'
  | 'day_off_cleared'

/** Payload of a 'completed' event. */
export interface CompletedPayload {
  late: boolean
  forOther: boolean
}
