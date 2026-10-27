import { render, screen } from '@testing-library/react'
import App from './App'
import { setAuthForTests } from './data/client'
import { t } from './i18n/es'

afterEach(() => setAuthForTests(null))

test('muestra el nombre de la app y pide iniciar sesión sin sesión', async () => {
  setAuthForTests({
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithOtp: () => Promise.resolve({ error: null }),
    verifyOtp: () => Promise.resolve({ error: null }),
  })
  render(<App />)
  expect(screen.getByText('Family Nest')).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
})

test('t interpola variables', () => {
  expect(t('createdBy', { nickname: 'Ana' })).toBe('Creada por Ana')
})
