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

test('pide solo la semana vista y vuelve a pedir al cambiar de semana', async () => {
  const user = userEvent.setup()
  render(
    <TasksProvider value={{ snapshot, reload: () => {}, readOnly: false }}>
      <EventLog onBack={() => {}} />
    </TasksProvider>,
  )
  await screen.findByRole('list', { name: 'Registro de eventos' })
  expect(repo.loadEvents).toHaveBeenLastCalledWith({ from: '2026-10-25T00:00:00Z', to: '2026-11-03T00:00:00Z' })
  await user.click(screen.getByRole('button', { name: 'Semana anterior' }))
  await waitFor(() =>
    expect(repo.loadEvents).toHaveBeenLastCalledWith({ from: '2026-10-18T00:00:00Z', to: '2026-10-27T00:00:00Z' }),
  )
})

test('demostración: avisa que es solo lectura y no consulta', () => {
  vi.mocked(repo.loadEvents).mockClear()
  render(
    <TasksProvider value={{ snapshot, reload: () => {}, readOnly: true }}>
      <EventLog onBack={() => {}} />
    </TasksProvider>,
  )
  expect(screen.getByText('Modo de demostración: solo lectura.')).toBeInTheDocument()
  expect(repo.loadEvents).not.toHaveBeenCalled()
})

test('muestra Cargando… sin mensajes de vacío mientras carga', async () => {
  vi.mocked(repo.loadEvents).mockReturnValue(new Promise(() => {}))
  render(
    <TasksProvider value={{ snapshot, reload: () => {}, readOnly: false }}>
      <EventLog onBack={() => {}} />
    </TasksProvider>,
  )
  expect(screen.getByText('Cargando…')).toBeInTheDocument()
  expect(screen.queryByText('No hay eventos con estos filtros.')).toBeNull()
  expect(screen.queryByText('Sin movimientos esta semana.')).toBeNull()
})
