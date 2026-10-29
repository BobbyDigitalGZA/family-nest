import { describe, expect, test } from 'vitest'
import { ev, m } from '../../test/factories'
import { toCsv, weeklySummary } from './toCsv'

const TZ = 'America/Lima'

test('CSV con apodo, hora local y comillas', () => {
  const csv = toCsv([ev({ at: '2026-10-28T01:05:00Z', actor: 'm1', type: 'moved', title: 'Platos, cena' })], [m('m1', 'Ana')], TZ)
  expect(csv.split('\n')[0]).toBe('fecha,hora,quién,acción,tarea,día de la tarea,equipo,detalle')
  expect(csv.split('\n')[1]).toBe('2026-10-27,20:05,Ana,movió,"Platos, cena",2026-10-26,pared,"{""to"":""2026-10-28""}"')
})

describe('toCsv', () => {
  test('celular, autor desconocido y comillas dobles', () => {
    const csv = toCsv(
      [ev({ at: '2026-10-28T15:00:00Z', actor: 'x', type: 'created', title: 'Sacar "la" basura', device: 'phone', payload: {} })],
      [m('m1', 'Ana')],
      TZ,
    )
    expect(csv.split('\n')[1]).toBe('2026-10-28,10:00,—,creó,"Sacar ""la"" basura",2026-10-26,celular,')
  })
  test('neutraliza fórmulas de hoja de cálculo', () => {
    const csv = toCsv([ev({ at: '2026-10-28T15:00:00Z', actor: 'm1', type: 'created', title: '=SUM(A1)', payload: {} })], [m('m1', '@Ana')], TZ)
    const row = csv.split('\n')[1]!
    expect(row).toContain(",'@Ana,")
    expect(row).toContain(",'=SUM(A1),")
  })
  test('saltos de línea dentro de un valor van entre comillas', () => {
    const csv = toCsv([ev({ at: '2026-10-28T15:00:00Z', actor: 'm1', type: 'created', title: 'a\nb', payload: {} })], [m('m1', 'Ana')], TZ)
    expect(csv).toContain('"a\nb"')
  })
})

describe('weeklySummary', () => {
  test('resumen semanal por persona', () => {
    const evs = [
      ev({ at: '2026-10-27T15:00:00Z', actor: 'm1', type: 'completed', title: 'Platos' }),
      ev({ at: '2026-10-27T16:00:00Z', actor: 'm1', type: 'moved', title: 'Basura' }),
      ev({ at: '2026-11-02T15:00:00Z', actor: 'm1', type: 'completed', title: 'Platos' }),
    ]
    expect(weeklySummary(evs, '2026-10-26', TZ)).toEqual([{ memberId: 'm1', created: 0, assigned: 0, completed: 1, moved: 1 }])
  })
  test('la semana se cuenta en la zona de la familia (lunes a domingo)', () => {
    // Lunes 26 00:30 en Lima = 05:30Z; domingo 25 23:30 en Lima = lunes 26 04:30Z.
    const evs = [
      ev({ at: '2026-10-26T04:30:00Z', actor: 'm1', type: 'created', title: 'a' }),
      ev({ at: '2026-10-26T05:30:00Z', actor: 'm1', type: 'created', title: 'b' }),
      ev({ at: '2026-11-02T04:59:00Z', actor: 'm1', type: 'created', title: 'c' }),
      ev({ at: '2026-11-02T05:00:00Z', actor: 'm1', type: 'created', title: 'd' }),
    ]
    expect(weeklySummary(evs, '2026-10-26', TZ)[0]?.created).toBe(2)
  })
  test('ignora otros tipos y ordena por miembro', () => {
    const evs = [
      ev({ at: '2026-10-27T15:00:00Z', actor: 'b', type: 'assigned', title: 'a' }),
      ev({ at: '2026-10-27T15:00:00Z', actor: 'a', type: 'renamed', title: 'a' }),
      ev({ at: '2026-10-27T15:00:00Z', actor: 'a', type: 'created', title: 'a' }),
    ]
    const members = [m('b', 'Bea', { sortOrder: 0 }), m('a', 'Ana', { sortOrder: 1 })]
    expect(weeklySummary(evs, '2026-10-26', TZ, members).map((r) => r.memberId)).toEqual(['b', 'a'])
    expect(weeklySummary(evs, '2026-10-26', TZ).map((r) => r.memberId)).toEqual(['a', 'b'])
  })
})
