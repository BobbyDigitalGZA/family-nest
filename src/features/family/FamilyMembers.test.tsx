import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import * as members from '../../data/members'
import type { FamilySnapshot } from '../../data/repo'
import { familyFromRow } from '../../data/mappers'
import { errorText } from '../auth/errors'
import { member, testFamily } from '../../test/factories'
import { IdentityProvider } from '../identity/IdentityProvider'
import { TasksProvider } from '../tasks/TasksProvider'
import { FamilyMembers } from './FamilyMembers'

vi.mock('../../data/members', () => ({ addMember: vi.fn(), updateMember: vi.fn() }))
afterEach(() => vi.clearAllMocks())

function snapshotWith(list = [member('m1', 'Ana', { authUserId: 'u1' }), member('m2', 'Leo', { sortOrder: 1, color: 'pink' })]): FamilySnapshot {
  return { family: { ...testFamily, joinCode: 'ABCD2345' }, members: list, tasks: [], overrides: [], completions: [] }
}

function renderScreen(snapshot = snapshotWith(), opts: { readOnly?: boolean } = {}) {
  const reload = vi.fn()
  render(
    <IdentityProvider device="phone" memberId="m1" members={snapshot.members}>
      <TasksProvider value={{ snapshot, reload, readOnly: opts.readOnly ?? false }}>
        <FamilyMembers onBack={vi.fn()} />
      </TasksProvider>
    </IdentityProvider>,
  )
  return { reload }
}

const row = (nick: string) => screen.getAllByTestId('fm-member').find((li) => li.textContent?.includes(nick))!

test('muestra el código de unión y el estado de cada miembro activo', () => {
  const snap = snapshotWith([
    member('m1', 'Ana', { authUserId: 'u1' }),
    member('m2', 'Leo', { sortOrder: 1 }),
    member('m3', 'Sol', { sortOrder: 2, authUserId: 'u3' }),
    member('m4', 'Tomi', { sortOrder: 3, active: false }),
  ])
  renderScreen(snap)
  expect(screen.getByTestId('fm-join-code')).toHaveTextContent('ABCD2345')
  expect(screen.getAllByTestId('fm-member')).toHaveLength(3)
  expect(row('Ana')).toHaveTextContent('Tú')
  expect(row('Leo')).toHaveTextContent('Falta que entre')
  expect(row('Sol')).toHaveTextContent('Ya entró')
})

test('nadie puede quitarse a sí mismo: el botón no aparece en su fila', () => {
  renderScreen()
  expect(within(row('Ana')).queryByRole('button', { name: 'Quitar a Ana' })).toBeNull()
  expect(within(row('Leo')).getByRole('button', { name: 'Quitar a Leo' })).toBeInTheDocument()
})

test('agregar un miembro llama a add_member con el apodo limpio y recarga', async () => {
  vi.mocked(members.addMember).mockResolvedValue('m9')
  const { reload } = renderScreen()
  await userEvent.type(screen.getAllByLabelText('Apodo').at(-1)!, '  Sol ')
  await userEvent.click(screen.getByRole('button', { name: 'Agregar' }))
  // Ana es azul y Leo rosa: el primer color libre es lila.
  expect(members.addMember).toHaveBeenCalledWith({ nickname: 'Sol', color: 'lilac', birthday: null })
  expect(reload).toHaveBeenCalled()
})

test('un apodo repetido o vacío no llega a la base', async () => {
  renderScreen()
  await userEvent.click(screen.getByRole('button', { name: 'Agregar' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Cada miembro necesita un apodo de 1 a 24 caracteres.')
  await userEvent.type(screen.getAllByLabelText('Apodo').at(-1)!, 'leo')
  await userEvent.click(screen.getByRole('button', { name: 'Agregar' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Dos miembros no pueden tener el mismo apodo.')
  expect(members.addMember).not.toHaveBeenCalled()
})

test('editar cambia apodo y color; quitar pide confirmación y desactiva', async () => {
  vi.mocked(members.updateMember).mockResolvedValue()
  renderScreen()
  await userEvent.click(screen.getByRole('button', { name: 'Editar a Leo' }))
  const input = within(row('Leo')).getByLabelText('Apodo')
  await userEvent.clear(input)
  await userEvent.type(input, 'Leito')
  await userEvent.selectOptions(within(row('Leo')).getByLabelText('Color'), 'green')
  await userEvent.click(within(row('Leo')).getByRole('button', { name: 'Guardar' }))
  expect(members.updateMember).toHaveBeenCalledWith('m2', { nickname: 'Leito', color: 'green' })

  await userEvent.click(screen.getByRole('button', { name: 'Quitar a Leo' }))
  expect(members.updateMember).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }))
  expect(members.updateMember).toHaveBeenLastCalledWith('m2', { active: false })
})

test('en modo de demostración no hay botones de cambio', () => {
  renderScreen(snapshotWith(), { readOnly: true })
  expect(screen.queryByRole('button', { name: 'Editar a Leo' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled()
})

test('el código de unión viene de la fila de la familia y los errores de la base se traducen', () => {
  expect(familyFromRow({ id: 'f', name: 'x', time_zone: 'UTC', join_code: 'ZZZZ2222' }).joinCode).toBe('ZZZZ2222')
  expect(errorText(new Error('duplicate key value violates unique constraint "member_nickname_active_uq"'))).toBe(
    'Dos miembros no pueden tener el mismo apodo.',
  )
  expect(errorText(new Error('nickname-taken'))).toBe('Dos miembros no pueden tener el mismo apodo.')
})
