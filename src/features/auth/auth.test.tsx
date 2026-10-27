import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setClientForTests } from '../../data/client'
import { makeFakeClient } from '../../test/fakeClient'
import { Claim } from './Claim'
import { Setup } from './Setup'
import { WallDevice } from './WallDevice'

let fake: ReturnType<typeof makeFakeClient>
beforeEach(() => {
  fake = makeFakeClient()
  setClientForTests(fake.client)
})
afterEach(() => setClientForTests(null))

test('Setup acepta cualquier número de miembros, guarda el país y muestra el código', async () => {
  fake.setRpcData('create_family', 'ABCD2345')
  fake.setTable('family', [{ id: 'f1' }])
  const onDone = vi.fn()
  render(<Setup onDone={onDone} />)
  await userEvent.type(screen.getByLabelText('Nombre de la familia'), 'Los Inventados')
  await userEvent.selectOptions(screen.getByLabelText('País de los festivos'), 'MX')
  await userEvent.type(screen.getByLabelText('Apodo'), 'Ana')
  for (const nick of ['Leo', 'Sol', 'Tomi', 'Vale', 'Nico']) {
    await userEvent.click(screen.getByRole('button', { name: 'Agregar miembro' }))
    const boxes = screen.getAllByLabelText('Apodo')
    await userEvent.type(boxes[boxes.length - 1]!, nick)
  }
  await userEvent.click(screen.getByRole('button', { name: 'Quitar a Nico' }))
  await userEvent.click(screen.getByRole('button', { name: 'Crear familia' }))
  expect(await screen.findByTestId('join-code')).toHaveTextContent('ABCD2345')
  const call = fake.rpcCalls('create_family')[0]!
  expect((call.p_members as { nickname: string }[]).map((m) => m.nickname)).toEqual([
    'Ana', 'Leo', 'Sol', 'Tomi', 'Vale',
  ])
  expect(call.p_time_zone).toEqual(expect.any(String))
  expect(fake.updates('family')[0]).toMatchObject({
    values: { country_code: 'MX' },
    filters: { id: 'f1' },
  })
})

test('Setup exige país y apodos antes de llamar a la base', async () => {
  render(<Setup onDone={() => {}} />)
  await userEvent.type(screen.getByLabelText('Nombre de la familia'), 'Los Inventados')
  await userEvent.click(screen.getByRole('button', { name: 'Crear familia' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Elige el país de los festivos.')
  expect(fake.rpcCalls('create_family')).toHaveLength(0)
})

test('un error de la RPC se muestra en español', async () => {
  fake.failRpc('family-already-exists')
  render(<Setup onDone={() => {}} />)
  await userEvent.type(screen.getByLabelText('Nombre de la familia'), 'Los Inventados')
  await userEvent.selectOptions(screen.getByLabelText('País de los festivos'), 'MX')
  await userEvent.type(screen.getByLabelText('Apodo'), 'Ana')
  await userEvent.click(screen.getByRole('button', { name: 'Crear familia' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Ya hay una familia configurada')
})

test('Claim lista los apodos libres del código y reclama el elegido', async () => {
  fake.setRpcData('list_claimable_members', [
    { id: 'm2', nickname: 'Leo', color: 'pink' },
    { id: 'm3', nickname: 'Sol', color: 'green' },
  ])
  const onDone = vi.fn()
  render(<Claim onDone={onDone} />)
  await userEvent.type(screen.getByLabelText('Código de unión de la familia'), 'abcd2345')
  await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
  const options = await screen.findAllByTestId('claim-option')
  expect(options.map((o) => o.textContent)).toEqual(['Leo', 'Sol'])
  await userEvent.click(options[1]!)
  await waitFor(() => expect(onDone).toHaveBeenCalled())
  expect(fake.rpcCalls('claim_member')[0]).toEqual({ p_member: 'm3', p_code: 'abcd2345' })
})

test('Claim sin apodos libres lo dice', async () => {
  fake.setRpcData('list_claimable_members', [])
  render(<Claim onDone={() => {}} />)
  await userEvent.type(screen.getByLabelText('Código de unión de la familia'), 'XXXX')
  await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
  expect(await screen.findByText('No hay apodos libres con ese código.')).toBeInTheDocument()
})

test('WallDevice registra la pantalla y, con código malo, avisa en español', async () => {
  const onDone = vi.fn()
  const { unmount } = render(<WallDevice onDone={onDone} />)
  await userEvent.type(screen.getByLabelText('Código de unión de la familia'), 'ABCD2345')
  await userEvent.type(screen.getByLabelText('Nombre de la pantalla (opcional)'), 'Cocina')
  await userEvent.click(screen.getByRole('button', { name: 'Registrar pantalla' }))
  await waitFor(() => expect(onDone).toHaveBeenCalled())
  expect(fake.rpcCalls('register_wall_device')[0]).toEqual({ p_code: 'ABCD2345', p_label: 'Cocina' })
  unmount()

  fake.failRpc('invalid-code')
  render(<WallDevice onDone={() => {}} />)
  await userEvent.type(screen.getByLabelText('Código de unión de la familia'), 'NOPE')
  await userEvent.click(screen.getByRole('button', { name: 'Registrar pantalla' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('El código de unión no es válido.')
})
