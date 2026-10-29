import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { member } from '../../test/factories'
import { IdentityProvider } from './IdentityProvider'
import { useActor } from './useActor'

const people = [member('m-Ana', 'Ana', { sortOrder: 0 }), member('m-Leo', 'Leo', { sortOrder: 1 })]

let result: string = 'pendiente'
function Asker() {
  const { requireActor, actorId } = useActor()
  return (
    <>
      <span data-testid="actor">{actorId ?? 'nadie'}</span>
      <button
        type="button"
        onClick={() =>
          requireActor().then(
            (id) => (result = id),
            (e: Error) => (result = e.message),
          )
        }
      >
        pedir
      </button>
    </>
  )
}

beforeEach(() => {
  result = 'pendiente'
})

test('cancelar ¿Quién eres? rechaza con identity-cancelled y cierra el diálogo', async () => {
  render(
    <IdentityProvider device="wall" members={people}>
      <Asker />
    </IdentityProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'pedir' }))
  const dialog = await screen.findByRole('dialog', { name: '¿Quién eres?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
  await waitFor(() => expect(result).toBe('identity-cancelled'))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('volver a la familia con la pregunta abierta la cierra y rechaza a quien esperaba', async () => {
  const holder = { back: () => {} }
  function Back() {
    const { backToFamily } = useActor()
    useEffect(() => {
      holder.back = backToFamily
    }, [backToFamily])
    return null
  }
  render(
    <IdentityProvider device="wall" members={people}>
      <Asker />
      <Back />
    </IdentityProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'pedir' }))
  await screen.findByRole('dialog', { name: '¿Quién eres?' })
  act(() => holder.back())
  await waitFor(() => expect(result).toBe('identity-cancelled'))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('desmontar con la pregunta abierta rechaza a quien esperaba', async () => {
  const { unmount } = render(
    <IdentityProvider device="wall" members={people}>
      <Asker />
    </IdentityProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'pedir' }))
  await screen.findByRole('dialog', { name: '¿Quién eres?' })
  unmount()
  await waitFor(() => expect(result).toBe('identity-cancelled'))
})

test('un actor vencido vuelve a preguntar aunque el reloj aún no haya corrido', () => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  try {
    render(
      <IdentityProvider device="wall" members={people}>
        <Asker />
      </IdentityProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'pedir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ana' }))
    expect(screen.getByTestId('actor')).toHaveTextContent('m-Ana')
    // el intervalo no corre: solo avanza la fecha
    vi.setSystemTime(Date.now() + 91_000)
    fireEvent.click(screen.getByRole('button', { name: 'pedir' }))
    expect(screen.getByRole('dialog', { name: '¿Quién eres?' })).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})
