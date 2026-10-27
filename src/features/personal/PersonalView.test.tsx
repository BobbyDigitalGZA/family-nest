import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DragEndEvent } from '@dnd-kit/core'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { setSnapshotSourceForTests } from '../../data/actions'
import * as repo from '../../data/repo'
import type { FamilySnapshot } from '../../data/repo'
import type { Task } from '../../domain/types'
import { c, member, task as makeTask, testFamily } from '../../test/factories'
import { IdentityProvider } from '../identity/IdentityProvider'
import { TasksProvider } from '../tasks/TasksProvider'
import { MonthTab } from './MonthTab'
import { PersonalView } from './PersonalView'

let dragEnd: ((e: DragEndEvent) => void) | undefined

vi.mock('@dnd-kit/core', async (orig) => {
  const actual = await orig<typeof import('@dnd-kit/core')>()
  const { createElement } = await import('react')
  return {
    ...actual,
    DndContext: (props: React.ComponentProps<typeof actual.DndContext>) => {
      dragEnd = props.onDragEnd
      return createElement(actual.DndContext, props)
    },
  }
})

vi.mock('../../data/repo', async (orig) => ({
  ...(await orig<typeof import('../../data/repo')>()),
  completeOccurrence: vi.fn(),
  uncompleteOccurrence: vi.fn(),
  moveOccurrence: vi.fn(),
  loadEvents: vi.fn(),
}))

const TODAY = '2026-10-27' // martes
const members = [member('m1', 'Ana', { sortOrder: 0, color: 'pink' }), member('m2', 'Leo', { sortOrder: 1 })]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-27T17:00:00Z')) // 12:00 p. m. en la zona de la familia
  vi.mocked(repo.loadEvents).mockResolvedValue([])
  vi.mocked(repo.moveOccurrence).mockResolvedValue()
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  dragEnd = undefined
  setSnapshotSourceForTests(null)
  Object.assign(window, { innerWidth: 1024, innerHeight: 768 })
})

const once = (id: string, title: string, date: string, assigneeId = 'm1'): Task =>
  makeTask({ kind: 'once', date }, { id, title, assigneeId, createdById: 'm1' })

/** Ana: la semana del 26 al 1 tiene 8 tareas y 5 hechas; hoy 2 y 1 hecha; el mes, 9 y 6. */
function fixtureWeek(opts: { daily?: boolean; tasksOn27?: number } = {}): FamilySnapshot {
  const tasks: Task[] = [
    once('t-regar', 'Regar plantas', '2026-10-26'),
    once('t-basura', 'Sacar la basura', TODAY),
    once('t-tarea', 'Hacer la tarea', TODAY),
    once('t-ordenar', 'Ordenar el cuarto', '2026-10-28'),
    once('t-leer', 'Leer un rato', '2026-10-28'),
    once('t-practicar', 'Practicar', '2026-10-29'),
    once('t-cuenta', 'Pagar la cuenta', '2026-10-30'),
    once('t-barrer', 'Barrer', '2026-10-31'),
    once('t-cama', 'Tender la cama', '2026-10-05'),
    once('t-leo', 'Tarea de Leo', TODAY, 'm2'),
  ]
  for (let i = 0; i < (opts.tasksOn27 ?? 0); i++) tasks.push(once(`t-x${i}`, `Extra ${i + 1}`, TODAY))
  if (opts.daily)
    tasks.push(
      makeTask(
        { kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6, 7], start: '2026-10-01', end: null },
        { id: 't-platos', title: 'Lavar platos', assigneeId: 'm1', createdById: 'm1' },
      ),
    )
  return {
    family: testFamily,
    members,
    tasks,
    overrides: [],
    completions: [
      c('t-regar', '2026-10-26'),
      c('t-basura', TODAY),
      c('t-ordenar', '2026-10-28'),
      c('t-leer', '2026-10-28'),
      c('t-practicar', '2026-10-29'),
      c('t-cama', '2026-10-05'),
    ],
  }
}

function setup(ui: React.ReactNode, snapshot: FamilySnapshot, readOnly = false) {
  setSnapshotSourceForTests(() => Promise.resolve(snapshot))
  const reload = vi.fn()
  return render(
    <IdentityProvider device="wall" members={snapshot.members}>
      <TasksProvider value={{ snapshot, reload, readOnly }}>{ui}</TasksProvider>
    </IdentityProvider>,
  )
}

const renderPersonal = (snapshot: FamilySnapshot, readOnly = false, onBack = vi.fn()) =>
  setup(<PersonalView memberId="m1" onBack={onBack} />, snapshot, readOnly)

const dayCell = (date: string) => screen.getByTestId(`day-${date}`)

async function openTab(name: 'Hoy' | 'Semana' | 'Mes') {
  await userEvent.click(screen.getByRole('tab', { name }))
}

/** Suelta una ocurrencia sobre otro día, como si se arrastrara (la mecánica la pone dnd-kit). */
function dropOccurrence(snapshot: FamilySnapshot, title: string, from: string, to: string) {
  const found = snapshot.tasks.find((x) => x.title === title)
  if (!found || !dragEnd) throw new Error('no hay nada que soltar')
  act(() => {
    dragEnd?.({ active: { id: `${found.id}|${from}` }, over: { id: `day:${to}` } } as unknown as DragEndEvent)
  })
}

async function pickActor(nick: string) {
  const d = await screen.findByRole('dialog', { name: '¿Quién eres?' })
  await userEvent.click(within(d).getByRole('button', { name: nick }))
}

test('el cumplimiento sigue a la pestaña activa', async () => {
  renderPersonal(fixtureWeek())
  expect(screen.getByTestId('compliance')).toHaveTextContent('50 % · 1 de 2')
  await openTab('Semana')
  expect(screen.getByTestId('compliance')).toHaveTextContent('63 % · 5 de 8')
  await openTab('Mes')
  expect(screen.getByTestId('compliance')).toHaveTextContent('67 % · 6 de 9')
})

test('soltar una diaria en un día donde ya ocurre no la mueve y avisa', async () => {
  const snapshot = fixtureWeek({ daily: true })
  renderPersonal(snapshot)
  await openTab('Semana')
  dropOccurrence(snapshot, 'Lavar platos', '2026-10-27', '2026-10-28')
  expect(repo.moveOccurrence).not.toHaveBeenCalled()
  // dnd-kit trae su propia región viva (también role=status): el aviso se identifica por su testid.
  const notice = await screen.findByTestId('move-status')
  expect(notice).toHaveAttribute('role', 'status')
  expect(notice).toHaveTextContent('Ese día ya tiene esta tarea')
})

test('en el mes también se arrastra a otro día', async () => {
  const snapshot = fixtureWeek()
  renderPersonal(snapshot)
  await openTab('Mes')
  dropOccurrence(snapshot, 'Sacar la basura', TODAY, '2026-10-30')
  await pickActor('Ana')
  await waitFor(() =>
    expect(repo.moveOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Sacar la basura' }),
      expect.anything(),
      TODAY,
      '2026-10-30',
      'm1',
      'wall',
    ),
  )
})

test('en la semana se arrastra entre días y soltar en el mismo día no hace nada', async () => {
  const snapshot = fixtureWeek()
  renderPersonal(snapshot)
  await openTab('Semana')
  dropOccurrence(snapshot, 'Hacer la tarea', TODAY, TODAY)
  expect(repo.moveOccurrence).not.toHaveBeenCalled()
  dropOccurrence(snapshot, 'Hacer la tarea', TODAY, '2026-10-31')
  await pickActor('Ana')
  await waitFor(() => expect(repo.moveOccurrence).toHaveBeenCalledTimes(1))
})

test('el mes marca hoy y agrupa lo que no cabe en +n', () => {
  setup(<MonthTab memberId="m1" cursor={TODAY} today={TODAY} visibleSlots={3} />, fixtureWeek({ tasksOn27: 5 }))
  // 7 tareas de Ana hoy: basura, tarea y 5 extras.
  expect(dayCell(TODAY)).toHaveTextContent('Hoy')
  expect(dayCell(TODAY)).toHaveTextContent('+4')
  expect(within(dayCell(TODAY)).getAllByRole('listitem')).toHaveLength(3)
})

test('en cada día va primero lo pendiente, luego lo no hecho y al final lo hecho', async () => {
  renderPersonal(fixtureWeek())
  await openTab('Mes')
  const titles = within(dayCell(TODAY))
    .getAllByRole('listitem')
    .map((li) => li.textContent)
  expect(titles[0]).toContain('Hacer la tarea')
  expect(titles[1]).toContain('Sacar la basura')
})

test('el número del día abre una ventana con todo ese día', async () => {
  setup(<MonthTab memberId="m1" cursor={TODAY} today={TODAY} visibleSlots={1} />, fixtureWeek({ tasksOn27: 3 }))
  expect(within(dayCell(TODAY)).getAllByRole('listitem')).toHaveLength(1)
  await userEvent.click(within(dayCell(TODAY)).getByRole('button', { name: /^27/ }))
  const dialog = screen.getByRole('dialog', { name: /27 de octubre/ })
  expect(within(dialog).getAllByRole('checkbox')).toHaveLength(5)
  expect(within(dialog).getByRole('button', { name: 'Nueva tarea' })).toBeInTheDocument()
})

test('el mes navega con ‹ › y vuelve a hoy', async () => {
  renderPersonal(fixtureWeek())
  await openTab('Mes')
  expect(screen.getByRole('heading', { name: /octubre de 2026/i })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
  expect(screen.getByRole('heading', { name: /septiembre de 2026/i })).toBeInTheDocument()
  expect(screen.getByTestId('compliance')).toHaveTextContent('Sin tareas')
  await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
  await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
  expect(screen.getByRole('heading', { name: /noviembre de 2026/i })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Volver a hoy' }))
  expect(screen.getByRole('heading', { name: /octubre de 2026/i })).toBeInTheDocument()
})

test('en el iPhone el mes muestra puntos y el día entero se toca', async () => {
  Object.assign(window, { innerWidth: 390, innerHeight: 844 })
  renderPersonal(fixtureWeek())
  await openTab('Mes')
  const cell = dayCell(TODAY)
  expect(cell.tagName).toBe('BUTTON')
  expect(within(cell).queryByRole('checkbox')).not.toBeInTheDocument()
  expect(cell.querySelectorAll('[data-dot]')).toHaveLength(2)
  await userEvent.click(cell)
  const dialog = screen.getByRole('dialog', { name: /27 de octubre/ })
  expect(within(dialog).getAllByRole('checkbox')).toHaveLength(2)
})

test('una ocurrencia que ya no se puede marcar muestra la casilla deshabilitada', async () => {
  renderPersonal(fixtureWeek())
  await openTab('Semana')
  // El lunes 26 ya pasó el plazo de las 10:00 a. m. del día siguiente.
  expect(screen.getByRole('checkbox', { name: 'Cumplir: Regar plantas' })).toBeDisabled()
  expect(screen.getByRole('checkbox', { name: 'Cumplir: Hacer la tarea' })).toBeEnabled()
})

test('la semana va de lunes a domingo', async () => {
  renderPersonal(fixtureWeek())
  await openTab('Semana')
  const days = screen.getAllByTestId(/^day-/).map((el) => el.getAttribute('data-testid'))
  expect(days).toEqual([
    'day-2026-10-26',
    'day-2026-10-27',
    'day-2026-10-28',
    'day-2026-10-29',
    'day-2026-10-30',
    'day-2026-10-31',
    'day-2026-11-01',
  ])
})

test('en demostración no se arrastra ni se escribe', async () => {
  renderPersonal(fixtureWeek(), true)
  await openTab('Semana')
  expect(screen.queryByRole('button', { name: /^Mover:/ })).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Cumplir: Hacer la tarea' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Nueva tarea' })).toBeDisabled()
})

test('cada tarea trae un asa para moverla con el teclado', async () => {
  renderPersonal(fixtureWeek())
  await openTab('Semana')
  expect(screen.getByRole('button', { name: 'Mover: Hacer la tarea' })).toBeInTheDocument()
})

test('volver a la familia avisa a quien llama', async () => {
  const onBack = vi.fn()
  renderPersonal(fixtureWeek(), false, onBack)
  await userEvent.click(screen.getByRole('button', { name: 'Volver a la familia' }))
  expect(onBack).toHaveBeenCalled()
})

test('apretar y mover el ratón dentro del detalle abierto no arrastra la tarea de atrás', async () => {
  renderPersonal(fixtureWeek())
  await openTab('Semana')
  await userEvent.click(screen.getByRole('button', { name: 'Hacer la tarea' }))
  const dialog = await screen.findByRole('dialog')
  const field = within(dialog).getAllByRole('textbox')[0] as HTMLElement
  fireEvent.mouseDown(field, { button: 0, clientX: 10, clientY: 10 })
  fireEvent.pointerDown(field, { button: 0, clientX: 10, clientY: 10 })
  fireEvent.touchStart(field, { touches: [{ clientX: 10, clientY: 10 }] })
  fireEvent.mouseMove(document, { clientX: 90, clientY: 90 })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60)) // el arrastre de dnd-kit arranca de forma asíncrona
  })
  expect(document.querySelector('.pv-overlay')).toBeNull()
  expect(repo.moveOccurrence).not.toHaveBeenCalled()
})

test('una ocurrencia bloqueada no tiene asa ni se mueve, y se avisa', async () => {
  const snapshot = fixtureWeek()
  renderPersonal(snapshot)
  await openTab('Semana')
  expect(screen.queryByRole('button', { name: 'Mover: Regar plantas' })).not.toBeInTheDocument()
  dropOccurrence(snapshot, 'Regar plantas', '2026-10-26', TODAY)
  expect(repo.moveOccurrence).not.toHaveBeenCalled()
  expect(await screen.findByTestId('move-status')).toHaveTextContent('Ya pasó el plazo para marcar esta tarea.')
})

test('soltar en un día cuya ventana cerró no la mueve y avisa', async () => {
  const snapshot = fixtureWeek()
  renderPersonal(snapshot)
  await openTab('Semana')
  dropOccurrence(snapshot, 'Hacer la tarea', TODAY, '2026-10-26') // ayer, pasadas las 10:00 a. m.
  expect(repo.moveOccurrence).not.toHaveBeenCalled()
  expect(await screen.findByTestId('move-status')).toHaveTextContent('No se puede mover a un día pasado.')
})

test('el candado de las 10:00 a. m. cambia con el reloj sin otro motivo para dibujar', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date('2026-10-27T14:59:00Z')) // 9:59 a. m. en la zona de la familia
  renderPersonal(fixtureWeek())
  fireEvent.click(screen.getByRole('tab', { name: 'Semana' }))
  expect(screen.getByRole('checkbox', { name: 'Cumplir: Regar plantas' })).toBeEnabled()
  act(() => {
    vi.advanceTimersByTime(61_000) // 10:00 a. m.
  })
  expect(screen.getByRole('checkbox', { name: 'Cumplir: Regar plantas' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Mover: Regar plantas' })).not.toBeInTheDocument()
})

test('Nueva tarea abre en hoy, o en el primer día visto si todo el rango es futuro', async () => {
  renderPersonal(fixtureWeek())
  await openTab('Mes')
  await userEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }))
  expect(screen.getByRole('button', { name: 'Hoy', pressed: true })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
  await userEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }))
  expect(screen.getByLabelText('Fecha')).toHaveValue('2026-11-01')
})

// Va al final: tras soltar, dnd-kit deja un rato un freno al clic que ensucia las pruebas siguientes.
test('control: apretar y mover sobre la tarea sí inicia el arrastre', async () => {
  renderPersonal(fixtureWeek())
  await openTab('Semana')
  const chip = screen.getByRole('button', { name: 'Hacer la tarea' }).closest('li') as HTMLElement
  fireEvent.mouseDown(chip, { button: 0, clientX: 10, clientY: 10 })
  fireEvent.mouseMove(document, { clientX: 90, clientY: 90 })
  await waitFor(() => expect(document.querySelector('.pv-overlay')).not.toBeNull())
  fireEvent.mouseUp(document)
  await waitFor(() => expect(document.querySelector('.pv-overlay')).toBeNull())
})
