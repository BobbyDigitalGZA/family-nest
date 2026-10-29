import { act, fireEvent, render } from '@testing-library/react'
import { IDENTITY_TIMEOUT_MS } from '../../domain/identity'
import { useWallIdle } from './useWallIdle'

function Probe({ wall, onIdle }: { wall: boolean; onIdle: () => void }) {
  useWallIdle(wall, onIdle)
  return null
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('en la pared, tras el plazo sin tocar, avisa una vez', () => {
  const onIdle = vi.fn()
  render(<Probe wall onIdle={onIdle} />)
  act(() => vi.advanceTimersByTime(IDENTITY_TIMEOUT_MS - 1))
  expect(onIdle).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1))
  expect(onIdle).toHaveBeenCalledTimes(1)
  act(() => vi.advanceTimersByTime(IDENTITY_TIMEOUT_MS * 3))
  expect(onIdle).toHaveBeenCalledTimes(1)
})

test('un toque o una tecla reinician la cuenta', () => {
  const onIdle = vi.fn()
  render(<Probe wall onIdle={onIdle} />)
  act(() => vi.advanceTimersByTime(IDENTITY_TIMEOUT_MS - 1000))
  fireEvent.pointerDown(document)
  act(() => vi.advanceTimersByTime(IDENTITY_TIMEOUT_MS - 1000))
  fireEvent.keyDown(document, { key: 'a' })
  act(() => vi.advanceTimersByTime(IDENTITY_TIMEOUT_MS - 1000))
  expect(onIdle).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1000))
  expect(onIdle).toHaveBeenCalledTimes(1)
})

test('en el teléfono nunca avisa', () => {
  const onIdle = vi.fn()
  render(<Probe wall={false} onIdle={onIdle} />)
  act(() => vi.advanceTimersByTime(IDENTITY_TIMEOUT_MS * 5))
  expect(onIdle).not.toHaveBeenCalled()
})
