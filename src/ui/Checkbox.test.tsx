import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from './Checkbox'

test('la casilla cumple al tocarla y se anuncia', async () => {
  const onToggle = vi.fn()
  render(<Checkbox checked={false} onToggle={onToggle} ariaLabel="Sacar la basura" />)
  await userEvent.click(screen.getByRole('checkbox', { name: 'Sacar la basura' }))
  expect(onToggle).toHaveBeenCalledOnce()
})

test('la barra espaciadora la activa y deshabilitada no hace nada', async () => {
  const onToggle = vi.fn()
  const { rerender } = render(<Checkbox checked={false} onToggle={onToggle} ariaLabel="x" />)
  screen.getByRole('checkbox').focus()
  await userEvent.keyboard(' ')
  expect(onToggle).toHaveBeenCalledOnce()
  rerender(<Checkbox checked={false} onToggle={onToggle} disabled ariaLabel="x" />)
  await userEvent.click(screen.getByRole('checkbox'))
  expect(onToggle).toHaveBeenCalledOnce()
})
