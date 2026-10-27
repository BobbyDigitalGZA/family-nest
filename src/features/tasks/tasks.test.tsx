import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cambiarCuandoToca, crearTarea, desmarcar, setSnapshotSourceForTests } from '../../data/actions'
import * as repo from '../../data/repo'
import type { EventRow, FamilySnapshot } from '../../data/repo'
import type { Occurrence, Recurrence, Task } from '../../domain/types'
import { member, task as makeTask, testFamily } from '../../test/factories'
import { IdentityProvider } from '../identity/IdentityProvider'
import { DeleteChoice } from './DeleteChoice'
import { NewTaskSheet } from './NewTaskSheet'
import { TaskDetail } from './TaskDetail'
import { TaskRow } from './TaskRow'
import { TasksProvider } from './TasksProvider'

vi.mock('../../data/repo', async (orig) => ({
  ...(await orig<typeof import('../../data/repo')>()),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  completeOccurrence: vi.fn(),
  uncompleteOccurrence: vi.fn(),
  moveOccurrence: vi.fn(),
  deleteOccurrence: vi.fn(),
  deleteSeriesFrom: vi.fn(),
  loadEvents: vi.fn(),
}))

const TODAY = '2026-10-27' // martes
const members = [
  member('m1', 'Ana', { sortOrder: 0 }),
  member('m2', 'Leo', { sortOrder: 1 }),
  member('m3', 'Sol', { sortOrder: 2 }),
]
const names: Record<string, string> = { Ana: 'm1', Leo: 'm2', Sol: 'm3' }

let events: EventRow[]
let reload: ReturnType<typeof vi.fn<() => void>>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-27T17:00:00Z')) // 12:00 p. m. en la zona de la familia
  events = []
  reload = vi.fn<() => void>()
  vi.mocked(repo.loadEvents).mockImplementation(() => Promise.resolve([...events]))
  vi.mocked(repo.updateTask).mockImplementation((_id, patch, actorId) => {
    const type = patch.title !== undefined ? 'renamed' : patch.assigneeId !== undefined ? 'assigned' : 'recurrence_changed'
    events.unshift({
      id: events.length + 1,
      at: '2026-10-27T17:00:00Z',
      actorId,
      type,
      taskId: 't1',
      taskTitle: null,
      occurrenceDate: null,
      device: 'wall',
      payload: { from: 'm1', to: patch.assigneeId ?? null },
    })
    return Promise.resolve()
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  setSnapshotSourceForTests(null)
})

const weekly: Recurrence = { kind: 'weekly', weekdays: [2], start: '2026-10-01', end: null }

function weeklyTask(patch: { createdBy?: string } = {}): Task {
  return makeTask(weekly, { createdById: names[patch.createdBy ?? 'Ana'] })
}

function occ(t: Task, date = TODAY): Occurrence {
  return { taskId: t.id, originalDate: date, date, excused: false }
}

function setup(ui: React.ReactNode, tasks: Task[], readOnly = false) {
  const snapshot: FamilySnapshot = { family: testFamily, members, tasks, overrides: [], completions: [] }
  setSnapshotSourceForTests(() => Promise.resolve(snapshot))
  return render(
    <IdentityProvider device="wall" members={members}>
      <TasksProvider value={{ snapshot, reload, readOnly }}>{ui}</TasksProvider>
    </IdentityProvider>,
  )
}

function renderRow(t: Task, date = TODAY, readOnly = false) {
  return setup(
    <ul>
      <TaskRow occurrence={occ(t, date)} task={t} />
    </ul>,
    [t],
    readOnly,
  )
}

async function pickActor(nick: string) {
  const d = await screen.findByRole('dialog', { name: '¿Quién eres?' })
  await userEvent.click(within(d).getByRole('button', { name: nick }))
}

test('la fila muestra tipo y autora', () => {
  renderRow(weeklyTask({ createdBy: 'Leo' }))
  expect(screen.getByText('Se repite')).toBeInTheDocument()
  expect(screen.getByText('Creada por Leo')).toBeInTheDocument()
})

test('la fila de un día y la mensual llevan su leyenda', () => {
  renderRow(makeTask({ kind: 'once', date: TODAY }))
  expect(screen.getByText('Un día')).toBeInTheDocument()
})

test('la mensual lleva «Cada mes»', () => {
  renderRow(makeTask({ kind: 'monthly', dayOfMonth: 27, start: '2026-10-01', end: null }))
  expect(screen.getByText('Cada mes')).toBeInTheDocument()
})

test('borrar una repetida pregunta siempre, desde la ✕ y desde el detalle', async () => {
  renderRow(weeklyTask())
  await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
  const d = await screen.findByRole('dialog', { name: 'Borrar tarea repetida' })
  expect(within(d).getByRole('button', { name: 'Solo esta ocurrencia' })).toBeInTheDocument()
  expect(within(d).getByRole('button', { name: 'Todas' })).toBeInTheDocument()
  await userEvent.click(within(d).getByRole('button', { name: 'Cancelar' }))

  await userEvent.click(screen.getByRole('button', { name: 'Sacar la basura' }))
  const detail = await screen.findByRole('dialog', { name: 'Sacar la basura' })
  await userEvent.click(within(detail).getByRole('button', { name: 'Borrar' }))
  const again = await screen.findByRole('dialog', { name: 'Borrar tarea repetida' })
  expect(within(again).getByRole('button', { name: 'Todas' })).toBeInTheDocument()
})

test('«Solo esta ocurrencia» borra esa fecha; «Todas» corta la serie desde ahí', async () => {
  const t = weeklyTask()
  renderRow(t)
  await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Solo esta ocurrencia' }))
  await pickActor('Ana')
  await waitFor(() => expect(repo.deleteOccurrence).toHaveBeenCalledWith('t1', TODAY, 'm1', 'wall'))

  await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Todas' }))
  await waitFor(() => expect(repo.deleteSeriesFrom).toHaveBeenCalledWith(t, TODAY, TODAY, 'm1', 'wall'))
})

test('una tarea de un día se borra sin la pregunta', async () => {
  renderRow(makeTask({ kind: 'once', date: TODAY }))
  await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
  await pickActor('Ana')
  await waitFor(() => expect(repo.deleteOccurrence).toHaveBeenCalledWith('t1', TODAY, 'm1', 'wall'))
  expect(screen.queryByRole('button', { name: 'Todas' })).toBeNull()
})

async function fillNewTask(o: {
  title: string
  repeat?: 'monthly' | 'weekly'
  day?: number
  noEnd?: boolean
  household?: boolean
}) {
  setup(<NewTaskSheet open onClose={() => {}} />, [])
  await userEvent.type(screen.getByLabelText('Nombre'), o.title)
  if (o.repeat) {
    await userEvent.click(screen.getByRole('checkbox', { name: 'Se repite' }))
    if (o.repeat === 'monthly') await userEvent.selectOptions(screen.getByLabelText('Se repite cada'), 'Mes')
  }
  if (o.day !== undefined) {
    const dom = screen.getByLabelText('Día del mes')
    await userEvent.clear(dom)
    await userEvent.type(dom, String(o.day))
  }
  if (o.noEnd === false) await userEvent.click(screen.getByRole('checkbox', { name: 'Sin fecha de fin' }))
  if (o.household) await userEvent.click(screen.getByRole('checkbox', { name: 'De la casa' }))
  await userEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
  await pickActor('Ana')
}

test('mensual con fin opcional y "De la casa"', async () => {
  await fillNewTask({ title: 'Pagar el agua', repeat: 'monthly', day: 31, noEnd: true, household: true })
  await waitFor(() =>
    expect(repo.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        isHousehold: true,
        recurrence: { kind: 'monthly', dayOfMonth: 31, start: '2026-10-27', end: null },
      }),
      'm1',
      'wall',
    ),
  )
})

test('nueva tarea de un día: Mañana', async () => {
  setup(<NewTaskSheet open onClose={() => {}} defaultAssigneeId="m3" />, [])
  await userEvent.type(screen.getByLabelText('Nombre'), 'Regar las plantas')
  await userEvent.click(screen.getByRole('button', { name: 'Mañana' }))
  await userEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
  await pickActor('Leo')
  await waitFor(() =>
    expect(repo.createTask).toHaveBeenCalledWith(
      {
        title: 'Regar las plantas',
        assigneeId: 'm3',
        isHousehold: false,
        recurrence: { kind: 'once', date: '2026-10-28' },
      },
      'm2',
      'wall',
    ),
  )
})

test('sin nombre no crea y avisa', async () => {
  setup(<NewTaskSheet open onClose={() => {}} />, [])
  await userEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Escribe el nombre de la tarea.')
  expect(repo.createTask).not.toHaveBeenCalled()
})

async function openDetail(title: string) {
  await userEvent.click(screen.getByRole('button', { name: title }))
  return screen.findByRole('dialog', { name: title })
}

test('el detalle reasigna y renombra, y el historial lo muestra', async () => {
  renderRow(makeTask({ kind: 'once', date: TODAY }))
  const d = await openDetail('Sacar la basura')
  await userEvent.selectOptions(within(d).getByLabelText('Para quién'), 'Sol')
  await pickActor('Ana')
  const name = within(d).getByLabelText('Nombre')
  await userEvent.clear(name)
  await userEvent.type(name, 'Sacar la basura y reciclar')
  await userEvent.click(within(d).getByRole('button', { name: 'Guardar nombre' }))
  await waitFor(() => expect(repo.updateTask).toHaveBeenCalledTimes(2))
  const list = await within(d).findByRole('list', { name: 'Historial' })
  await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2))
  const items = within(list).getAllByRole('listitem').map((li) => li.textContent ?? '')
  expect(items).toEqual(
    expect.arrayContaining([
      expect.stringContaining('asignó a Sol'),
      expect.stringContaining('cambió el nombre'),
    ]),
  )
  expect(items.join(' ')).toContain('Ana')
})

test('el detalle muestra creación, fecha, tipo y mueve solo esa ocurrencia', async () => {
  const t = weeklyTask()
  renderRow(t)
  const d = await openDetail('Sacar la basura')
  expect(within(d).getByText('1 de octubre de 2026')).toBeInTheDocument()
  expect(within(d).getByText(/^Tarea ·/)).toBeInTheDocument()
  const due = within(d).getByLabelText('Fecha en que toca')
  fireEvent.change(due, { target: { value: '2026-10-28' } })
  fireEvent.change(due, { target: { value: '2026-10-29' } })
  // escribir la fecha no mueve nada: solo el botón «Mover»
  expect(screen.queryByRole('dialog', { name: '¿Quién eres?' })).toBeNull()
  expect(repo.moveOccurrence).not.toHaveBeenCalled()
  await userEvent.click(within(d).getByRole('button', { name: 'Mover' }))
  await pickActor('Ana')
  await waitFor(() =>
    expect(repo.moveOccurrence).toHaveBeenCalledWith(t, [], TODAY, '2026-10-29', 'm1', 'wall'),
  )
})

test('«Cuándo toca» convierte una de un día en repetida para toda la serie', async () => {
  renderRow(makeTask({ kind: 'once', date: TODAY }))
  const d = await openDetail('Sacar la basura')
  await userEvent.click(within(d).getByRole('button', { name: 'Se repite' }))
  await userEvent.click(within(d).getByRole('button', { name: 'Guardar cuándo toca' }))
  await pickActor('Ana')
  await waitFor(() =>
    expect(repo.updateTask).toHaveBeenCalledWith(
      't1',
      { recurrence: { kind: 'weekly', weekdays: [2], start: TODAY, end: null } },
      'm1',
      'wall',
    ),
  )
})

test('cerrar «¿Quién eres?» sin elegir no actúa y no muestra error', async () => {
  renderRow(weeklyTask())
  await userEvent.click(screen.getByRole('checkbox'))
  const d = await screen.findByRole('dialog', { name: '¿Quién eres?' })
  await userEvent.click(within(d).getByRole('button', { name: 'Cancelar' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.queryByRole('alert')).toBeNull()
  expect(repo.completeOccurrence).not.toHaveBeenCalled()
})

test('un error del servidor se traduce y se muestra', async () => {
  vi.mocked(repo.completeOccurrence).mockRejectedValueOnce(new Error('locked'))
  renderRow(weeklyTask())
  await userEvent.click(screen.getByRole('checkbox'))
  await pickActor('Ana')
  expect(await screen.findByRole('alert')).toHaveTextContent('Ya pasó el plazo para marcar esta tarea.')
})

test('una de un día pasado queda bloqueada tras las 10:00 a. m. del día siguiente', () => {
  renderRow(makeTask({ kind: 'once', date: '2026-10-25' }), '2026-10-25')
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.getByText('Bloqueada')).toBeInTheDocument()
})

test('una marcada fuera de la ventana no se puede desmarcar (casilla y acción)', async () => {
  const t = makeTask({ kind: 'once', date: '2026-10-25' })
  const snapshot: FamilySnapshot = {
    family: testFamily,
    members,
    tasks: [t],
    overrides: [],
    completions: [
      { taskId: 't1', occurrenceDate: '2026-10-25', completedAt: '2026-10-25T20:00:00Z', completedById: 'm1', late: false },
    ],
  }
  setSnapshotSourceForTests(() => Promise.resolve(snapshot))
  render(
    <IdentityProvider device="wall" members={members}>
      <TasksProvider value={{ snapshot, reload, readOnly: false }}>
        <ul>
          <TaskRow occurrence={occ(t, '2026-10-25')} task={t} />
        </ul>
      </TasksProvider>
    </IdentityProvider>,
  )
  expect(screen.getByRole('checkbox')).toBeDisabled()
  await expect(desmarcar('t1', '2026-10-25', 'm1', 'wall')).rejects.toThrow('locked')
  expect(repo.uncompleteOccurrence).not.toHaveBeenCalled()
  // hoy sí se puede desmarcar
  setSnapshotSourceForTests(() => Promise.resolve({ ...snapshot, tasks: [makeTask({ kind: 'once', date: TODAY })] }))
  await desmarcar('t1', TODAY, 'm1', 'wall')
  expect(repo.uncompleteOccurrence).toHaveBeenCalledWith('t1', TODAY, 'm1', 'wall')
})

test('el detalle relee sus valores en cada apertura', async () => {
  const t = makeTask({ kind: 'once', date: TODAY })
  const snap = (title: string): FamilySnapshot => ({
    family: testFamily,
    members,
    tasks: [{ ...t, title }],
    overrides: [],
    completions: [],
  })
  const ui = (title: string, open: boolean) => (
    <IdentityProvider device="wall" members={members}>
      <TasksProvider value={{ snapshot: snap(title), reload, readOnly: false }}>
        <TaskDetail taskId="t1" originalDate={TODAY} open={open} onClose={() => {}} />
      </TasksProvider>
    </IdentityProvider>
  )
  const view = render(ui('Sacar la basura', true))
  expect(screen.getByLabelText('Nombre')).toHaveValue('Sacar la basura')
  view.rerender(ui('Sacar la basura', false))
  view.rerender(ui('Sacar el reciclaje', false))
  view.rerender(ui('Sacar el reciclaje', true))
  expect(screen.getByLabelText('Nombre')).toHaveValue('Sacar el reciclaje')
})

test('la nueva tarea empieza limpia y relee los valores por defecto en cada apertura', async () => {
  const snapshot: FamilySnapshot = { family: testFamily, members, tasks: [], overrides: [], completions: [] }
  const ui = (open: boolean, who: string) => (
    <IdentityProvider device="wall" members={members}>
      <TasksProvider value={{ snapshot, reload, readOnly: false }}>
        <NewTaskSheet open={open} onClose={() => {}} defaultAssigneeId={who} />
      </TasksProvider>
    </IdentityProvider>
  )
  const view = render(ui(true, 'm2'))
  await userEvent.type(screen.getByLabelText('Nombre'), 'borrador')
  expect(screen.getByLabelText('Para quién')).toHaveValue('m2')
  view.rerender(ui(false, 'm2'))
  view.rerender(ui(true, 'm3'))
  expect(screen.getByLabelText('Nombre')).toHaveValue('')
  expect(screen.getByLabelText('Para quién')).toHaveValue('m3')
})

test('crearTarea y cambiarCuandoToca rechazan recurrencias inválidas en la capa de acciones', async () => {
  const snapshot: FamilySnapshot = { family: testFamily, members, tasks: [makeTask({ kind: 'once', date: TODAY })], overrides: [], completions: [] }
  setSnapshotSourceForTests(() => Promise.resolve(snapshot))
  const bad: Recurrence = { kind: 'weekly', weekdays: [], start: TODAY, end: null }
  await expect(
    crearTarea({ title: 'x', assigneeId: 'm1', isHousehold: false, recurrence: bad }, 'm1', 'wall'),
  ).rejects.toThrow('weekdays-required')
  await expect(cambiarCuandoToca('t1', { ...bad, weekdays: [2], end: '2026-01-01' }, 'm1', 'wall')).rejects.toThrow(
    'end-before-start',
  )
  expect(repo.createTask).not.toHaveBeenCalled()
  expect(repo.updateTask).not.toHaveBeenCalled()
})

test('en demostración (solo lectura) no se puede escribir', () => {
  renderRow(weeklyTask(), TODAY, true)
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Borrar' })).toBeDisabled()
})

test('la casilla pasa por «¿Quién eres?» y cumple con el actor elegido', async () => {
  renderRow(weeklyTask())
  await userEvent.click(screen.getByRole('checkbox'))
  await pickActor('Leo')
  await waitFor(() =>
    expect(repo.completeOccurrence).toHaveBeenCalledWith('t1', TODAY, 'm2', 'wall', false, true),
  )
})

test('DeleteChoice se puede usar suelto', async () => {
  const t = weeklyTask()
  setup(<DeleteChoice task={t} originalDate={TODAY} open onClose={() => {}} />, [t])
  expect(screen.getByRole('button', { name: 'Todas' })).toBeInTheDocument()
})
