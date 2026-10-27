import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { FamilySnapshot } from './repo'
import { useFamilyData } from './useFamilyData'

const pending: { resolve: (s: FamilySnapshot) => void; reject: (e: Error) => void }[] = []

vi.mock('./repo', () => ({
  loadFamilySnapshot: () =>
    new Promise<FamilySnapshot>((resolve, reject) => pending.push({ resolve, reject })),
}))
vi.mock('./realtime', () => ({ subscribeFamily: () => () => {} }))

const snap = (name: string) =>
  ({
    family: { id: 'f1', name, timeZone: 'America/Lima', lateMarkUntil: '10:00' },
    members: [],
    tasks: [],
    overrides: [],
    completions: [],
  }) as FamilySnapshot

afterEach(() => {
  pending.length = 0
})

test('una respuesta vieja que llega después de una nueva se descarta', async () => {
  const { result } = renderHook(() => useFamilyData())
  await act(async () => pending[0]!.resolve(snap('primera')))
  void act(() => void result.current.reload()) // pedido 2
  void act(() => void result.current.reload()) // pedido 3
  await act(async () => pending[2]!.resolve(snap('nueva')))
  await act(async () => pending[1]!.resolve(snap('vieja')))
  expect(result.current.snapshot?.family.name).toBe('nueva')
  // Un error viejo tampoco borra lo aplicado.
  void act(() => void result.current.reload()) // pedido 4
  void act(() => void result.current.reload()) // pedido 5
  await act(async () => pending[4]!.resolve(snap('última')))
  await act(async () => pending[3]!.reject(new Error('lento')))
  expect(result.current.snapshot?.family.name).toBe('última')
  expect(result.current.error).toBeNull()
})

test('nada se aplica después de desmontar', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { result, unmount } = renderHook(() => useFamilyData())
  unmount()
  await act(async () => pending[0]!.resolve(snap('tarde')))
  expect(result.current.snapshot).toBeNull()
  expect(errors).not.toHaveBeenCalled()
  errors.mockRestore()
})
