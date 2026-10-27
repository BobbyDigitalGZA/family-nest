import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

test('Escape cierra solo la hoja de arriba y las hojas viven en el body', async () => {
  const closed: string[] = []
  const { container } = render(
    <div style={{ transform: 'translateZ(0)' }}>
      <Sheet open onClose={() => closed.push('a')} title="a">
        <p>A</p>
      </Sheet>
      <Sheet open onClose={() => closed.push('b')} title="b">
        <p>B</p>
      </Sheet>
    </div>,
  )
  expect(container.querySelector('[role="dialog"]')).toBeNull()
  expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(2)
  await userEvent.keyboard('{Escape}')
  expect(closed).toEqual(['b'])
})
