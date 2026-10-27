import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { member } from '../../test/factories'
import { Checkbox } from '../../ui/Checkbox'
import type { Member } from '../../domain/types'
import { IdentityProvider } from './IdentityProvider'
import { useActor } from './useActor'

function members(nicknames: string[]): Member[] {
  return nicknames.map((n, i) => member(`m-${n}`, n, { sortOrder: i }))
}

function Probe() {
  const { actorId, requireActor, device } = useActor()
  return (
    <div>
      <span data-testid="actor">{actorId ?? 'nadie'}</span>
      <span data-testid="device">{device}</span>
      <Checkbox
        checked={false}
        ariaLabel="cumplir"
        onToggle={() => void requireActor().then((id) => (document.title = id), () => {})}
      />
    </div>
  )
}

function renderWithWall(list: Member[]) {
  return render(
    <IdentityProvider device="wall" members={list}>
      <Probe />
    </IdentityProvider>,
  )
}

test('en la pared, cumplir sin actor pregunta ¿Quién eres? con todos los miembros', async () => {
  renderWithWall(members(['Ana', 'Leo', 'Sol', 'Tomi', 'Vale']))
  await userEvent.click(screen.getAllByRole('checkbox')[0]!)
  const dialog = await screen.findByRole('dialog', { name: '¿Quién eres?' })
  expect(within(dialog).getAllByTestId('who-option').map((b) => b.textContent)).toEqual([
    'Ana',
    'Leo',
    'Sol',
    'Tomi',
    'Vale',
  ])
})

test('lista a cualquier número de miembros activos y omite a los inactivos', async () => {
  const many = members(['Ana', 'Leo', 'Sol', 'Tomi', 'Vale', 'Nico', 'Lía', 'Beto', 'Eli'])
  many[1] = { ...many[1]!, active: false }
  renderWithWall(many)
  await userEvent.click(screen.getByRole('checkbox'))
  const dialog = await screen.findByRole('dialog', { name: '¿Quién eres?' })
  expect(within(dialog).getAllByTestId('who-option')).toHaveLength(8)
  expect(within(dialog).queryByText('Leo')).toBeNull()
})

test('al elegir, requireActor resuelve con esa persona y el diálogo se cierra', async () => {
  renderWithWall(members(['Ana', 'Leo']))
  await userEvent.click(screen.getByRole('checkbox'))
  await userEvent.click(await screen.findByRole('button', { name: 'Leo' }))
  await waitFor(() => expect(document.title).toBe('m-Leo'))
  expect(screen.getByTestId('actor')).toHaveTextContent('m-Leo')
  expect(screen.queryByRole('dialog')).toBeNull()
  // con actor vigente ya no pregunta
  await userEvent.click(screen.getByRole('checkbox'))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('el actor de la pared caduca a los 90 s sin actividad', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    renderWithWall(members(['Ana', 'Leo']))
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(await screen.findByRole('button', { name: 'Ana' }))
    expect(screen.getByTestId('actor')).toHaveTextContent('m-Ana')
    act(() => void vi.advanceTimersByTime(89_000))
    expect(screen.getByTestId('actor')).toHaveTextContent('m-Ana')
    act(() => void vi.advanceTimersByTime(3_000))
    expect(screen.getByTestId('actor')).toHaveTextContent('nadie')
  } finally {
    vi.useRealTimers()
  }
})

test('con cuenta de miembro (teléfono) el actor es siempre ese miembro y nunca pregunta', async () => {
  render(
    <IdentityProvider device="phone" memberId="m-Leo" members={members(['Ana', 'Leo'])}>
      <Probe />
    </IdentityProvider>,
  )
  expect(screen.getByTestId('actor')).toHaveTextContent('m-Leo')
  expect(screen.getByTestId('device')).toHaveTextContent('phone')
  await userEvent.click(screen.getByRole('checkbox'))
  await waitFor(() => expect(document.title).toBe('m-Leo'))
  expect(screen.queryByRole('dialog')).toBeNull()
})
