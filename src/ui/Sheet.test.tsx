import { render, screen } from '@testing-library/react'
import { Sheet } from './Sheet'

test('un re-render con otro onClose conserva el foco', () => {
  const { rerender } = render(
    <Sheet open onClose={() => {}}>
      <input aria-label="campo" />
    </Sheet>,
  )
  const input = screen.getByLabelText('campo')
  input.focus()
  rerender(
    <Sheet open onClose={() => {}}>
      <input aria-label="campo" />
    </Sheet>,
  )
  expect(input).toHaveFocus()
})
