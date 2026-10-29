import { expect, test } from 'vitest'
import { demoSnapshot } from './fixtures'

test.each([4, 9])('demo de %i miembros: apodos, reglas y un apodo largo', (n) => {
  const s = demoSnapshot(n, new Date('2026-10-28T15:00:00Z'))
  expect(s.members).toHaveLength(n)
  expect(new Set(s.tasks.map((t) => t.recurrence.kind))).toEqual(new Set(['weekly', 'once', 'monthly']))
  if (n === 9) expect(s.members.some((m) => m.nickname.length >= 20)).toBe(true)
})
