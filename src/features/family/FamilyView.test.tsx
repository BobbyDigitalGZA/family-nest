import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { FamilySnapshot } from '../../data/repo'
import { familyColumns } from '../../domain/layout'
import type { Task } from '../../domain/types'
import { c, member, task, testFamily } from '../../test/factories'
import { IdentityProvider } from '../identity/IdentityProvider'
import { TasksProvider } from '../tasks/TasksProvider'
import { FamilyView } from './FamilyView'

const NAMES = ['Ana', 'Leo', 'Sol', 'Tomi', 'Vale', 'Nico', 'Lía', 'Beto', 'Mía']

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-27T17:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  Object.assign(window, { innerWidth: 1024, innerHeight: 768 })
})

function fixtureFamily(opts: { members: number; today: string; longNickname?: string }): FamilySnapshot {
  const members = Array.from({ length: opts.members }, (_, i) =>
    member(`m${i + 1}`, i === 0 && opts.longNickname ? opts.longNickname : (NAMES[i] ?? `P${i}`), { sortOrder: i }),
  )
  // Ana (m1): dos tareas de hoy, una cumplida. Los demás: una pendiente.
  const tasks: Task[] = members.flatMap((m, i) => [
    task({ kind: 'once', date: opts.today }, { id: `a${i}`, assigneeId: m.id, createdById: m.id }),
    ...(i === 0 ? [task({ kind: 'once', date: opts.today }, { id: 'b0', title: 'Otra', assigneeId: m.id, createdById: m.id })] : []),
  ])
  return {
    family: testFamily,
    members,
    tasks,
    overrides: [],
    completions: [c('a0', opts.today)],
  }
}

function renderFamily(snapshot: FamilySnapshot, onOpenMember = vi.fn()) {
  return render(
    <IdentityProvider device="wall" members={snapshot.members}>
      <TasksProvider value={{ snapshot, reload: vi.fn(), readOnly: false }}>
        <FamilyView onOpenMember={onOpenMember} />
      </TasksProvider>
    </IdentityProvider>,
  )
}

const ribbonPill = (nick: string) => screen.getByTestId(`pill-${nick}`)

test('una columna por miembro con su número de tareas de hoy y su cumplimiento', () => {
  renderFamily(fixtureFamily({ members: 4, today: '2026-10-27' }))
  expect(screen.getAllByTestId('member-column')).toHaveLength(4)
  expect(within(ribbonPill('Ana')).getByText('2')).toBeInTheDocument()
  expect(screen.getByTestId('compliance-Ana')).toHaveTextContent('50 % · 1 de 2')
  expect(screen.getByTestId('compliance-Leo')).toHaveTextContent('0 % · 0 de 1')
})

test.each([1, 4, 9])('con %i miembros nada se desborda y los apodos largos usan elipsis', (n) => {
  renderFamily(fixtureFamily({ members: n, today: '2026-10-27', longNickname: 'Maximiliana-Josefina' }))
  expect(screen.getByTestId('family-grid').style.getPropertyValue('--cols')).toBe(String(familyColumns(n, 'landscape')))
  expect(screen.getAllByTestId('nickname')[0]).toHaveClass('ellipsis')
})

test('la píldora no cuenta las ocurrencias excusadas, como el cumplimiento', () => {
  const snapshot = fixtureFamily({ members: 2, today: '2026-10-27' })
  snapshot.overrides = [{ taskId: 'b0', occurrenceDate: '2026-10-27', movedTo: null, deleted: false, excusedById: 'm2' }]
  renderFamily(snapshot)
  expect(within(ribbonPill('Ana')).getByText('1')).toBeInTheDocument()
  expect(screen.getByTestId('compliance-Ana')).toHaveTextContent('100 % · 1 de 1')
})

test('tocar una píldora abre al miembro', () => {
  const open = vi.fn()
  renderFamily(fixtureFamily({ members: 3, today: '2026-10-27' }), open)
  ribbonPill('Leo').click()
  expect(open).toHaveBeenCalledWith('m2')
})

test('la pared se escala con la ventana y se recalcula al cambiar su tamaño', () => {
  Object.assign(window, { innerWidth: 2560, innerHeight: 1600 })
  renderFamily(fixtureFamily({ members: 4, today: '2026-10-27' }))
  expect(screen.getByTestId('wall-canvas').style.transform).toBe('scale(2)')
  Object.assign(window, { innerWidth: 1080, innerHeight: 1920 })
  window.dispatchEvent(new Event('resize'))
  return vi.waitFor(() => {
    expect(screen.getByTestId('wall-canvas').style.transform).toBe('scale(1.35)')
    expect(screen.getByTestId('family-grid').style.getPropertyValue('--cols')).toBe('2')
  })
})
