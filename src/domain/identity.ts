export const IDENTITY_TIMEOUT_MS = 90_000

export type IdentityState = { actorId: string | null; lastActivityAt: number }

export type IdentityAction =
  | { type: 'choose'; memberId: string; now: number }
  | { type: 'activity'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'backToFamily' }

export function identityReducer(
  s: IdentityState,
  a: IdentityAction,
): IdentityState {
  switch (a.type) {
    case 'choose':
      return { actorId: a.memberId, lastActivityAt: a.now }
    case 'activity':
      return s.actorId === null ? s : { ...s, lastActivityAt: a.now }
    case 'tick':
      return s.actorId !== null && a.now - s.lastActivityAt >= IDENTITY_TIMEOUT_MS
        ? { ...s, actorId: null }
        : s
    case 'backToFamily':
      return { ...s, actorId: null }
  }
}
