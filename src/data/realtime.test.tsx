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
  fake.setTable('family', [{ id: 'f1', name: 'F', time_zone: 'America/Lima' }])
  for (const t of ['member', 'task', 'occurrence_override', 'completion']) fake.setTable(t, [])
})
afterEach(() => setClientForTests(null))

test('subscribeFamily avisa de cambios en las cinco tablas y se cancela', () => {
  const onChange = vi.fn()
  const off = subscribeFamily(onChange)
  for (const t of ['family', 'task', 'occurrence_override', 'completion', 'member']) fake.emit(t)
  expect(onChange).toHaveBeenCalledTimes(5)
  off()
  fake.emit('task')
  expect(onChange).toHaveBeenCalledTimes(5)
  expect(fake.listenerCount()).toBe(0)
})

test('recarga al (re)unirse el canal, tras un error o timeout, al volver a la pestaña y al volver la red', () => {
  const onChange = vi.fn()
  const off = subscribeFamily(onChange)
  fake.setStatus('SUBSCRIBED')
  fake.setStatus('CHANNEL_ERROR')
  fake.setStatus('TIMED_OUT')
  fake.setStatus('SUBSCRIBED') // rejoin
  fake.setStatus('CLOSED')
  expect(onChange).toHaveBeenCalledTimes(4)
  const visibility = vi.spyOn(document, 'visibilityState', 'get')
  visibility.mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(onChange).toHaveBeenCalledTimes(4)
  visibility.mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  window.dispatchEvent(new Event('online'))
  expect(onChange).toHaveBeenCalledTimes(6)
  off()
  fake.setStatus('SUBSCRIBED')
  document.dispatchEvent(new Event('visibilitychange'))
  window.dispatchEvent(new Event('online'))
  expect(onChange).toHaveBeenCalledTimes(6)
  visibility.mockRestore()
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

test('dos suscripciones seguidas (StrictMode) usan canales distintos y ambas se liberan', () => {
  const a = vi.fn()
  const b = vi.fn()
  const offA = subscribeFamily(a)
  const offB = subscribeFamily(b)
  const names = fake.channelNames()
  expect(names).toHaveLength(2)
  expect(new Set(names).size).toBe(2)
  offA()
  fake.emit('task')
  expect(a).not.toHaveBeenCalled()
  expect(b).toHaveBeenCalledTimes(1)
  offB()
  expect(fake.listenerCount()).toBe(0)
})
