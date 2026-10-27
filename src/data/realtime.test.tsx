import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { makeFakeClient } from '../test/fakeClient'
import { setClientForTests } from './client'
import { subscribeFamily } from './realtime'
import { useFamilyData } from './useFamilyData'

let fake: ReturnType<typeof makeFakeClient>
beforeEach(() => {
  fake = makeFakeClient()
  setClientForTests(fake.client)
  fake.setTable('family', [{ id: 'f1', name: 'F', time_zone: 'America/Bogota' }])
  for (const t of ['member', 'task', 'occurrence_override', 'completion']) fake.setTable(t, [])
})
afterEach(() => setClientForTests(null))

test('subscribeFamily avisa de cambios en las cuatro tablas y se cancela', () => {
  const onChange = vi.fn()
  const off = subscribeFamily(onChange)
  for (const t of ['task', 'occurrence_override', 'completion', 'member']) fake.emit(t)
  expect(onChange).toHaveBeenCalledTimes(4)
  off()
  fake.emit('task')
  expect(onChange).toHaveBeenCalledTimes(4)
  expect(fake.listenerCount()).toBe(0)
})

test('useFamilyData carga y recarga ante un cambio', async () => {
  const { result, unmount } = renderHook(() => useFamilyData())
  await waitFor(() => expect(result.current.snapshot?.tasks).toEqual([]))
  fake.setTable('member', [{ id: 'm1', family_id: 'f1', nickname: 'Ana', color: 'blue' }])
  await act(async () => fake.emit('member'))
  await waitFor(() => expect(result.current.snapshot?.members).toHaveLength(1))
  unmount()
  expect(fake.listenerCount()).toBe(0)
})
