import { identityReducer } from './identity'

test('el actor caduca a los 90 s sin actividad', () => {
  let s = identityReducer({ actorId: null, lastActivityAt: 0 }, { type: 'choose', memberId: 'm1', now: 0 })
  s = identityReducer(s, { type: 'activity', now: 60_000 })
  expect(identityReducer(s, { type: 'tick', now: 149_999 }).actorId).toBe('m1')
  expect(identityReducer(s, { type: 'tick', now: 150_000 }).actorId).toBeNull()
})
test('volver a la vista familiar suelta al actor', () => {
  const s = { actorId: 'm1', lastActivityAt: 0 }
  expect(identityReducer(s, { type: 'backToFamily' }).actorId).toBeNull()
})
