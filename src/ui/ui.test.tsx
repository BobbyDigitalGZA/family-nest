import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgressBar } from './ProgressBar'
import { Sheet } from './Sheet'

test('la hoja se cierra con Escape y con el fondo', async () => {
  const onClose = vi.fn()
  render(<Sheet open onClose={onClose}>hola</Sheet>)
  expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByTestId('sheet-backdrop'))
  expect(onClose).toHaveBeenCalledTimes(2)
})

test('la hoja cerrada no pinta nada', () => {
  render(<Sheet open={false} onClose={() => {}}>hola</Sheet>)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('la barra expone su valor acotado', () => {
  render(<ProgressBar value={140} color="blue" />)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
})
