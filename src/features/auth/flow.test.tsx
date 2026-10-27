import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setAuthForTests, setClientForTests, type AuthLike } from '../../data/client'
import { makeFakeClient } from '../../test/fakeClient'
import { AuthGate } from './AuthGate'
import { Setup } from './Setup'
import { SignIn } from './SignIn'

let fake: ReturnType<typeof makeFakeClient>
beforeEach(() => {
  fake = makeFakeClient()
  setClientForTests(fake.client)
})
afterEach(() => {
  setClientForTests(null)
  setAuthForTests(null)
})

function fakeAuth(over: Partial<AuthLike> = {}): AuthLike {
  return {
    getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithOtp: () => Promise.resolve({ error: null }),
    verifyOtp: () => Promise.resolve({ error: null }),
    ...over,
  }
}

test('Setup marca al primer miembro como quien crea la familia, también tras quitar', async () => {
  render(<Setup onDone={() => {}} />)
  expect(screen.getByRole('group', { name: 'Miembro 1 · Este eres tú' })).toBeInTheDocument()
  expect(screen.getByTestId('member-you')).toHaveTextContent('Tu cuenta quedará ligada')
  await userEvent.click(screen.getByRole('button', { name: 'Agregar miembro' }))
  await userEvent.type(screen.getAllByLabelText('Apodo')[0]!, 'Ana')
  await userEvent.type(screen.getAllByLabelText('Apodo')[1]!, 'Leo')
  await userEvent.click(screen.getByRole('button', { name: 'Quitar a Ana' }))
  expect(screen.getAllByLabelText('Apodo')).toHaveLength(1)
  expect(screen.getByLabelText('Apodo')).toHaveValue('Leo')
  expect(screen.getByRole('group', { name: 'Miembro 1 · Este eres tú' })).toBeInTheDocument()
  expect(screen.getAllByTestId('member-you')).toHaveLength(1)
})

test('Setup rechaza apodos repetidos sin distinguir mayúsculas', async () => {
  render(<Setup onDone={() => {}} />)
  await userEvent.type(screen.getByLabelText('Nombre de la familia'), 'Los Inventados')
  await userEvent.selectOptions(screen.getByLabelText('País de los festivos'), 'MX')
  await userEvent.click(screen.getByRole('button', { name: 'Agregar miembro' }))
  await userEvent.type(screen.getAllByLabelText('Apodo')[0]!, 'Ana')
  await userEvent.type(screen.getAllByLabelText('Apodo')[1]!, ' ana ')
  await userEvent.click(screen.getByRole('button', { name: 'Crear familia' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Dos miembros no pueden tener el mismo apodo.',
  )
  expect(fake.rpcCalls('create_family')).toHaveLength(0)
})

test('sin miembro ni familia, tras iniciar sesión se abre Setup', async () => {
  setAuthForTests(fakeAuth())
  fake.setRpcData('family_exists', false)
  render(<AuthGate>{null}</AuthGate>)
  expect(await screen.findByRole('heading', { name: 'Configurar la familia' })).toBeInTheDocument()
})

test('con familia y sin miembro se abre Claim, con la opción de la pantalla de la casa', async () => {
  setAuthForTests(fakeAuth())
  fake.setRpcData('family_exists', true)
  render(<AuthGate>{null}</AuthGate>)
  expect(await screen.findByRole('heading', { name: 'Unirme con un código' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Esta es la pantalla de la casa' }))
  expect(
    await screen.findByRole('heading', { name: 'Esta es la pantalla de la casa' }),
  ).toBeInTheDocument()
})

test('si getSession falla se avisa en español y se puede reintentar', async () => {
  setAuthForTests(fakeAuth({ getSession: () => Promise.reject(new Error('boom')) }))
  render(<AuthGate>{null}</AuthGate>)
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos comprobar tu sesión.')
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
})

test('SignIn: verifyOtp con type email, solo con 6 dígitos y error en español', async () => {
  const verifyOtp = vi.fn(() => Promise.resolve({ error: { message: 'bad' } }))
  setAuthForTests(fakeAuth({ verifyOtp }))
  render(<SignIn />)
  await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@example.test')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
  const input = await screen.findByLabelText('Código de verificación')
  const enter = screen.getByRole('button', { name: 'Entrar' })
  await userEvent.type(input, '12345')
  expect(enter).toBeDisabled()
  await userEvent.type(input, '67')
  expect(input).toHaveValue('123456')
  expect(enter).toBeEnabled()
  await userEvent.click(enter)
  expect(await screen.findByRole('alert')).toHaveTextContent('El código no es válido o venció')
  expect(verifyOtp).toHaveBeenCalledWith({ email: 'ana@example.test', token: '123456', type: 'email' })
})
