import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as repo from '../../data/repo'
import { ev, member, testFamily } from '../../test/factories'
import { TasksProvider } from '../tasks/TasksProvider'
import { EventLog } from './EventLog'

vi.mock('../../data/repo', async (orig) => ({
  ...(await orig<typeof import('../../data/repo')>()),
  loadEvents: vi.fn(),
}))

const snapshot = {
  family: testFamily,
  members: [member('m1', 'Ana'), member('m2', 'Leo', { sortOrder: 1 })],
  tasks: [],
  overrides: [],
  completions: [],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-28T15:00:00Z') })
  vi.mocked(repo.loadEvents).mockResolvedValue([
    ev({ id: 1, at: '2026-10-27T15:00:00Z', actor: 'm1', type: 'completed', title: 'Platos' }),
    ev({ id: 2, at: '2026-10-27T16:00:00Z', actor: 'm2', type: 'moved', title: 'Basura' }),
  ])
})

test('lista, resumen y filtros por persona y acción', async () => {
  const user = userEvent.setup()
  render(
    <TasksProvider value={{ snapshot, reload: () => {}, readOnly: false }}>
      <EventLog onBack={() => {}} />
    </TasksProvider>,
  )
  const list = await screen.findByRole('list', { name: 'Registro de eventos' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  await user.selectOptions(screen.getByLabelText('Persona'), 'm2')
  expect(within(list).getAllByRole('listitem')).toHaveLength(1)
  await user.selectOptions(screen.getByLabelText('Acción'), 'completed')
  await waitFor(() => expect(screen.getByText('No hay eventos con estos filtros.')).toBeInTheDocument())
})
