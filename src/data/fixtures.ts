import { todayIn, weekStart, addDays } from '../domain/dates'
import type { Completion, Member, Task, Weekday } from '../domain/types'
import type { FamilySnapshot } from './repo'

// In-memory provider for `npm run dev` with ?demo=4 or ?demo=9. Invented
// people only. useFamilyData loads this module with a dynamic import behind
// import.meta.env.DEV, so production bundles never include it.

const NICKNAMES = [
  'Ana',
  'Leo',
  'Sol',
  'Tomi',
  'Vale',
  'Maximiliana-Josefina',
  'Nico',
  'Lía',
  'Beto',
]
const COLORS = ['blue', 'pink', 'lilac', 'green']
const TIME_ZONE = 'America/Bogota'

export function demoSnapshot(size: number, now: Date = new Date()): FamilySnapshot {
  const n = Math.max(1, Math.min(size, NICKNAMES.length))
  const today = todayIn(TIME_ZONE, now)
  const monday = weekStart(today)

  const members: Member[] = Array.from({ length: n }, (_, i) => ({
    id: `demo-m${i + 1}`,
    familyId: 'demo',
    nickname: NICKNAMES[i] ?? `Persona ${i + 1}`,
    color: COLORS[i % COLORS.length] ?? 'blue',
    birthday: null,
    sortOrder: i,
    authUserId: null,
    active: true,
  }))

  const tasks: Task[] = []
  const completions: Completion[] = []
  const base = { familyId: 'demo', createdAt: `${monday}T12:00:00Z`, deletedAt: null }
  members.forEach((m, i) => {
    const weekdays: Weekday[] = i % 2 === 0 ? [1, 2, 3, 4, 5] : [2, 4, 6]
    tasks.push(
      {
        ...base,
        id: `demo-w${i}`,
        title: i % 2 === 0 ? 'Tender la cama' : 'Sacar la basura',
        assigneeId: m.id,
        createdById: m.id,
        isHousehold: false,
        recurrence: { kind: 'weekly', weekdays, start: addDays(monday, -28), end: null },
      },
      {
        ...base,
        id: `demo-o${i}`,
        title: 'Preparar la mochila',
        assigneeId: m.id,
        createdById: members[0]?.id ?? m.id,
        isHousehold: i === 1,
        recurrence: { kind: 'once', date: addDays(monday, i % 7) },
      },
    )
    // The first weekly occurrence of the current week is done.
    const firstDay = addDays(monday, weekdays[0]! - 1)
    if (firstDay <= today) {
      completions.push({
        taskId: `demo-w${i}`,
        occurrenceDate: firstDay,
        completedAt: `${firstDay}T15:00:00Z`,
        completedById: m.id,
        late: false,
      })
    }
  })
  tasks.push({
    ...base,
    id: 'demo-monthly',
    title: 'Pagar el internet',
    assigneeId: members[0]?.id ?? '',
    createdById: members[0]?.id ?? '',
    isHousehold: true,
    recurrence: { kind: 'monthly', dayOfMonth: 31, start: addDays(monday, -60), end: null },
  })

  return {
    family: { id: 'demo', name: 'Familia de demostración', timeZone: TIME_ZONE, lateMarkUntil: '10:00' },
    members,
    tasks,
    overrides: [],
    completions,
  }
}
