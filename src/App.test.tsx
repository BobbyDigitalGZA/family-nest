import { render, screen } from '@testing-library/react'
import App from './App'
import { t } from './i18n/es'

test('muestra el nombre de la app', () => {
  render(<App />)
  expect(screen.getByText('Family Nest')).toBeInTheDocument()
})

test('t interpola variables', () => {
  expect(t('createdBy', { nickname: 'Ana' })).toBe('Creada por Ana')
})
