import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeFakeClient } from '../test/fakeClient'
import { task, testSnapshot } from '../test/factories'
import { asignar, completar, crearTarea, cumplimiento, tareasDeHoy } from './actions'
import { setSnapshotSourceForTests } from './actions'
import { setClientForTests } from './client'
import {
  createTask,
  deleteOccurrence,
  deleteSeriesFrom,
  excuseOccurrence,
  loadEvents,
  loadFamilySnapshot,
  logInteraction,
  moveOccurrence,
  uncompleteOccurrence,
} from './repo'

let fake: ReturnType<typeof makeFakeClient>

beforeEach(() => {
  fake = makeFakeClient()
  setClientForTests(fake.client)
  setSnapshotSourceForTests(() => Promise.resolve(testSnapshot()))
})
afterEach(() => {
  vi.useRealTimers()
  setClientForTests(null)
  setSnapshotSourceForTests(null)
})

describe('brief', () => {
  test('completar llama a rpc_complete con late y forOther calculados', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T14:00:00Z')) // 9:00 a. m. en la zona de la familia de prueba
    await completar('t-ayer-de-Leo', '2026-10-26', 'm-Ana', 'wall')
    expect(fake.rpcCalls('rpc_complete')).toEqual([
      expect.objectContaining({
        p_task_id: 't-ayer-de-Leo',
        p_date: '2026-10-26',
        p_late: true,
        p_for_other: true,
        p_actor: 'm-Ana',
        p_device: 'wall',
      }),
    ])
  })

  test('mover a un día donde ya ocurre no llama a la RPC', async () => {
    const dailyTask = task({
      kind: 'weekly',
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      start: '2026-10-01',
      end: null,
    })
    await expect(
      moveOccurrence(dailyTask, [], '2026-10-27', '2026-10-28', 'm1', 'phone'),
    ).rejects.toThrow('already-occurs')
    expect(fake.rpcCalls('rpc_move')).toEqual([])
  })

  test('cumplimiento de la semana con su texto', async () => {
    expect(await cumplimiento('m-Ana', 'week', '2026-10-27')).toEqual({
      done: 5,
      total: 8,
      percent: 63,
      text: '63 % · 5 de 8',
    })
  })
})

describe('completar', () => {
  test('después de las 10:00 del día siguiente queda bloqueado y no llama a la RPC', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T15:30:00Z')) // 10:30 a. m.
    await expect(completar('t-ayer-de-Leo', '2026-10-26', 'm-Ana', 'wall')).rejects.toThrow(
      'locked',
    )
    expect(fake.rpcCalls('rpc_complete')).toEqual([])
  })

  test('una ocurrencia movida a más adelante se juzga por su día nuevo', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T15:30:00Z')) // 10:30 a. m., pasado el corte del día 26
    const snap = testSnapshot()
    snap.overrides = [
      { taskId: 't-ayer-de-Leo', occurrenceDate: '2026-10-26', movedTo: '2026-10-29', deleted: false, excusedById: null },
    ]
    setSnapshotSourceForTests(() => Promise.resolve(snap))
    await completar('t-ayer-de-Leo', '2026-10-26', 'm-Ana', 'wall')
    expect(fake.rpcCalls('rpc_complete')[0]).toMatchObject({ p_date: '2026-10-26', p_late: false })
  })

  test('una ocurrencia movida a un día anterior ya vencido queda bloqueada', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T15:30:00Z'))
    const snap = testSnapshot()
    snap.overrides = [
      { taskId: 't-hoy-de-Sol', occurrenceDate: '2026-10-27', movedTo: '2026-10-25', deleted: false, excusedById: null },
    ]
    setSnapshotSourceForTests(() => Promise.resolve(snap))
    await expect(completar('t-hoy-de-Sol', '2026-10-27', 'm-Sol', 'phone')).rejects.toThrow('locked')
    expect(fake.rpcCalls('rpc_complete')).toEqual([])
  })

  test('el asignado marcando lo suyo no es forOther', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T14:00:00Z'))
    await completar('t-hoy-de-Sol', '2026-10-27', 'm-Sol', 'phone')
    expect(fake.rpcCalls('rpc_complete')[0]).toMatchObject({ p_late: false, p_for_other: false })
  })

  test('un actor ajeno a la familia no puede actuar', async () => {
    await expect(completar('t-hoy-de-Sol', '2026-10-27', 'm-Fuera', 'phone')).rejects.toThrow(
      'not-a-member',
    )
    expect(fake.rpcCalls('rpc_complete')).toEqual([])
  })

  test('un miembro inactivo tampoco', async () => {
    await expect(asignar('t-hoy-de-Sol', 'm-Ana', 'm-Tomi', 'phone')).rejects.toThrow(
      'not-a-member',
    )
  })
})

describe('otras acciones', () => {
  test('asignar y crearTarea van por sus RPC', async () => {
    await asignar('t-hoy-de-Sol', 'm-Leo', 'm-Ana', 'wall')
    expect(fake.rpcCalls('rpc_update_task')).toEqual([
      {
        p_task_id: 't-hoy-de-Sol',
        p_patch: { assignee_id: 'm-Leo' },
        p_actor: 'm-Ana',
        p_device: 'wall',
      },
    ])
    await crearTarea(
      {
        title: 'Regar',
        assigneeId: 'm-Leo',
        isHousehold: false,
        recurrence: { kind: 'once', date: '2026-10-28' },
      },
      'm-Ana',
      'phone',
    )
    expect(fake.rpcCalls('rpc_create_task')[0]).toMatchObject({
      p_actor: 'm-Ana',
      p_task: {
        title: 'Regar',
        assignee_id: 'm-Leo',
        is_household: false,
        rule: 'once',
        due_date: '2026-10-28',
      },
    })
  })

  test('tareasDeHoy usa la fecha de la zona de la familia', async () => {
    // 03:00Z del 28 es todavía 27 en Bogotá (UTC-5)
    const now = new Date('2026-10-28T03:00:00Z')
    expect((await tareasDeHoy('m-Sol', now)).map((x) => x.taskId)).toEqual(['t-hoy-de-Sol'])
    expect((await tareasDeHoy(null, now)).map((x) => x.taskId).sort()).toEqual([
      't-ana-diaria',
      't-hoy-de-Sol',
    ])
  })

  test('cumplimiento del día y del mes', async () => {
    expect(await cumplimiento('m-Ana', 'day', '2026-10-27')).toMatchObject({
      done: 1,
      total: 1,
      text: '100 % · 1 de 1',
    })
    // octubre 2026: 22 laborales + 4 sábados (3, 10, 17, 24, 31 = 5) + 2 de una vez
    const m = await cumplimiento('m-Ana', 'month', '2026-10-15')
    expect(m.total).toBe(22 + 5 + 2)
    expect(m.done).toBe(5)
  })

  test('sin tareas el texto es "Sin tareas"', async () => {
    expect((await cumplimiento('m-Leo', 'day', '2026-11-20')).text).toBe('Sin tareas')
  })
})

describe('repo', () => {
  test('uncomplete, delete y excuse llaman a su RPC con actor y dispositivo', async () => {
    await uncompleteOccurrence('t1', '2026-10-27', 'm1', 'wall')
    await deleteOccurrence('t1', '2026-10-27', 'm1', 'wall')
    await excuseOccurrence('t1', '2026-10-27', 'm1', 'phone')
    expect(fake.rpcCalls('rpc_uncomplete')).toEqual([
      { p_task_id: 't1', p_date: '2026-10-27', p_actor: 'm1', p_device: 'wall' },
    ])
    expect(fake.rpcCalls('rpc_delete_occurrence')).toHaveLength(1)
    expect(fake.rpcCalls('rpc_excuse')[0]).toMatchObject({ p_device: 'phone' })
  })

  test('mover válido llama a rpc_move', async () => {
    const t = task({ kind: 'once', date: '2026-10-27' })
    await moveOccurrence(t, [], '2026-10-27', '2026-10-29', 'm1', 'phone')
    expect(fake.rpcCalls('rpc_move')).toEqual([
      {
        p_task_id: 't1',
        p_date: '2026-10-27',
        p_target: '2026-10-29',
        p_actor: 'm1',
        p_device: 'phone',
      },
    ])
  })

  test('mover a la misma fecha falla con same-date', async () => {
    const t = task({ kind: 'once', date: '2026-10-27' })
    await expect(
      moveOccurrence(t, [], '2026-10-27', '2026-10-27', 'm1', 'phone'),
    ).rejects.toThrow('same-date')
  })

  test('deleteSeriesFrom recorta la serie con la regla nueva', async () => {
    const t = task({ kind: 'weekly', weekdays: [1, 2], start: '2026-10-01', end: null })
    await deleteSeriesFrom(t, '2026-10-29', '2026-10-27', 'm1', 'wall')
    expect(fake.rpcCalls('rpc_end_series')).toEqual([
      {
        p_task_id: 't1',
        p_new_rule: {
          rule: 'weekly',
          weekdays: [1, 2],
          start_date: '2026-10-01',
          end_date: '2026-10-28',
          due_date: null,
          month_day: null,
        },
        p_actor: 'm1',
        p_device: 'wall',
      },
    ])
  })

  test('deleteSeriesFrom manda null cuando se borra la tarea', async () => {
    const t = task({ kind: 'once', date: '2026-10-29' })
    await deleteSeriesFrom(t, '2026-10-29', '2026-10-27', 'm1', 'wall')
    expect(fake.rpcCalls('rpc_end_series')[0]).toMatchObject({ p_new_rule: null })
  })

  test('un error de la RPC se propaga', async () => {
    fake.failRpc('boom')
    await expect(
      createTask(
        {
          title: 'x',
          assigneeId: 'a',
          isHousehold: false,
          recurrence: { kind: 'once', date: '2026-10-28' },
        },
        'm1',
        'wall',
      ),
    ).rejects.toThrow('boom')
  })

  test('logInteraction escribe en la tabla interaction', async () => {
    fake.setTable('member', [{ id: 'm1', family_id: 'f1' }])
    await expect(logInteraction('m1', 'wall', 'open')).resolves.toBeUndefined()
    expect(fake.inserts('interaction')).toEqual([
      { family_id: 'f1', member_id: 'm1', device: 'wall', kind: 'open' },
    ])
  })

  test('loadFamilySnapshot y loadEvents mapean filas', async () => {
    fake.setTable('family', [
      { id: 'f1', name: 'F', time_zone: 'America/Bogota', late_mark_until: '10:00:00' },
    ])
    fake.setTable('member', [
      { id: 'm1', family_id: 'f1', nickname: 'Ana', color: 'blue', sort_order: 1 },
    ])
    fake.setTable('task', [
      {
        id: 't1',
        family_id: 'f1',
        title: 'X',
        assignee_id: 'm1',
        created_by_id: 'm1',
        created_at: 'z',
        is_household: false,
        rule: 'once',
        due_date: '2026-10-27',
        deleted_at: null,
      },
    ])
    fake.setTable('occurrence_override', [])
    fake.setTable('completion', [])
    fake.setTable('event_log', [
      {
        id: 2,
        at: '2026-10-27T10:00:00Z',
        actor_id: 'm1',
        type: 'completed',
        task_id: 't1',
        occurrence_date: '2026-10-27',
        device: 'wall',
        payload: { late: false },
      },
      {
        id: 1,
        at: '2026-10-27T09:00:00Z',
        actor_id: 'm1',
        type: 'created',
        task_id: null,
        occurrence_date: null,
        device: 'phone',
        payload: {},
      },
    ])
    const s = await loadFamilySnapshot()
    expect(s.family.timeZone).toBe('America/Bogota')
    expect(s.tasks[0]?.recurrence).toEqual({ kind: 'once', date: '2026-10-27' })
    const ev = await loadEvents({ type: 'completed' })
    expect(ev).toEqual([expect.objectContaining({ id: 2, taskTitle: 'X', actorId: 'm1' })])
  })

  test('las lecturas se paginan: 2,500 marcas vuelven todas, en orden estable', async () => {
    fake.setTable('family', [
      { id: 'f1', name: 'F', time_zone: 'America/Lima', late_mark_until: '10:00:00' },
    ])
    fake.setTable('member', [])
    fake.setTable('task', [])
    fake.setTable('occurrence_override', [])
    const many = Array.from({ length: 2500 }, (_, i) => ({
      task_id: `t${i % 7}`,
      occurrence_date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      family_id: 'f1',
      completed_at: '2026-01-01T00:00:00Z',
      completed_by_id: 'm1',
      late: false,
      n: i,
    }))
    fake.setTable('completion', many)
    const s = await loadFamilySnapshot()
    expect(s.completions).toHaveLength(2500)
    expect(fake.ranges('completion').map((r) => [r.from, r.to])).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  test('el fake corta en 1000 como PostgREST: sin paginar se perderían filas', async () => {
    fake.setTable('task', Array.from({ length: 1500 }, (_, i) => ({ id: `t${i}` })))
    const raw = (await fake.client.from('task').select('*')).data as unknown[]
    expect(raw).toHaveLength(1000)
  })

  test('loadEvents pagina eventos y títulos (solo id y título)', async () => {
    fake.setTable(
      'task',
      Array.from({ length: 1200 }, (_, i) => ({ id: `t${String(i).padStart(4, '0')}`, title: `T${i}` })),
    )
    fake.setTable(
      'event_log',
      Array.from({ length: 1300 }, (_, i) => ({
        id: i + 1,
        at: '2026-10-27T10:00:00Z',
        actor_id: 'm1',
        type: 'completed',
        task_id: 't1199',
        occurrence_date: null,
        device: 'wall',
        payload: {},
      })),
    )
    const got = await loadEvents({ taskId: 't1199' })
    expect(got).toHaveLength(1300)
    expect(got[0]).toMatchObject({ id: 1300, taskTitle: 'T1199' })
    expect(fake.ranges('task')).toHaveLength(2)
  })

  test('loadEvents pasa los límites de tiempo a la consulta', async () => {
    fake.setTable('task', [])
    fake.setTable('event_log', [
      { id: 1, at: '2026-10-25T10:00:00Z', actor_id: 'm1', type: 'created', device: 'wall', payload: {} },
      { id: 2, at: '2026-10-27T10:00:00Z', actor_id: 'm1', type: 'created', device: 'wall', payload: {} },
      { id: 3, at: '2026-11-05T10:00:00Z', actor_id: 'm1', type: 'created', device: 'wall', payload: {} },
    ])
    const got = await loadEvents({ from: '2026-10-25T12:00:00Z', to: '2026-11-03T00:00:00Z' })
    expect(got.map((e) => e.id)).toEqual([2])
    expect(fake.bounds('event_log')).toEqual([
      { table: 'event_log', op: 'gte', col: 'at', val: '2026-10-25T12:00:00Z' },
      { table: 'event_log', op: 'lt', col: 'at', val: '2026-11-03T00:00:00Z' },
    ])
  })
})
