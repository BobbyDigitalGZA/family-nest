// Comprobación de RLS y RPC contra el proyecto de PRUEBAS (nunca el real).
// Uso: npx tsx scripts/rls-check.ts   (lee .env.test.local)
import { randomBytes } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

process.loadEnvFile('.env.test.local')
const url = process.env.VITE_SUPABASE_URL
const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !publishable || !secret) throw new Error('Faltan variables en .env.test.local')

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, secret, opts)
const password = randomBytes(24).toString('base64url')
const tag = randomBytes(4).toString('hex')

const createdUsers: string[] = []
const createdFamilies: string[] = []

async function newUser(label: string): Promise<{ id: string; client: SupabaseClient }> {
  const email = `rls-${label}-${tag}@example.test`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser ${label}: ${error?.message}`)
  createdUsers.push(data.user.id)
  const client = createClient(url!, publishable!, opts)
  const signed = await client.auth.signInWithPassword({ email, password })
  if (signed.error) throw new Error(`signIn ${label}: ${signed.error.message}`)
  return { id: data.user.id, client }
}

async function must<T>(
  p: PromiseLike<{ data: T; error: { message: string } | null }>,
  what: string,
): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

interface Fixture {
  familyId: string
  code: string
  members: string[]
  taskId: string
  weeklyId: string
}

async function newFamily(label: string): Promise<Fixture> {
  const code = `T${randomBytes(3).toString('hex').toUpperCase()}`
  const family = await must(
    admin
      .from('family')
      .insert({ name: `RLSCHK ${label} ${tag}`, time_zone: 'UTC', join_code: code })
      .select('id')
      .single(),
    'insert family',
  )
  createdFamilies.push(family.id)
  const members = await must(
    admin
      .from('member')
      .insert(
        ['Uno', 'Dos', 'Tres'].map((nickname, i) => ({
          family_id: family.id,
          nickname,
          color: 'blue',
          sort_order: i,
        })),
      )
      .select('id, sort_order')
      .order('sort_order'),
    'insert members',
  )
  const ids = members.map((m) => m.id as string)
  const once = await must(
    admin
      .from('task')
      .insert({
        family_id: family.id,
        title: `Tarea ${label}`,
        assignee_id: ids[0],
        created_by_id: ids[0],
        rule: 'once',
        due_date: '2030-01-10',
      })
      .select('id')
      .single(),
    'insert task',
  )
  const weekly = await must(
    admin
      .from('task')
      .insert({
        family_id: family.id,
        title: `Semanal ${label}`,
        assignee_id: ids[1],
        created_by_id: ids[0],
        rule: 'weekly',
        weekdays: [1, 3],
        start_date: '2030-01-01',
      })
      .select('id')
      .single(),
    'insert weekly task',
  )
  return { familyId: family.id, code, members: ids, taskId: once.id, weeklyId: weekly.id }
}

async function cleanup(): Promise<void> {
  for (const id of createdFamilies) {
    for (const t of [
      'event_log',
      'interaction',
      'completion',
      'occurrence_override',
      'task',
      'wall_device',
      'member',
    ]) {
      await admin.from(t).delete().eq('family_id', id)
    }
    await admin.from('family').delete().eq('id', id)
  }
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id)
}

const results: { name: string; ok: boolean; detail?: string }[] = []
async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    results.push({ name, ok: true })
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) })
  }
}
function expect(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}
const denied = (e: { message: string } | null): boolean => e !== null

async function main(): Promise<void> {
  const A = await newFamily('A')
  const B = await newFamily('B')
  const userA = await newUser('a')
  const userC = await newUser('c')
  const userD = await newUser('d')
  await must(admin.from('member').update({ auth_user_id: userA.id }).eq('id', A.members[0]!), 'link A')
  const a = userA.client
  const actorA = A.members[0]!

  await check('usuario A ve solo su familia', async () => {
    const tasks = await must(a.from('task').select('*'), 'select task')
    expect(tasks.length >= 2, 'A no ve sus tareas')
    expect(tasks.every((t) => t.family_id === A.familyId), 'A ve filas de otra familia')
    const fam = await must(a.from('family').select('id'), 'select family')
    expect(fam.length === 1 && fam[0]!.id === A.familyId, 'A ve otra familia')
    const mem = await must(a.from('member').select('family_id'), 'select member')
    expect(mem.length === 3 && mem.every((m) => m.family_id === A.familyId), 'A ve miembros ajenos')
  })

  await check('usuario A no puede insertar en la familia B', async () => {
    const r1 = await a.from('task').insert({
      family_id: B.familyId,
      title: 'x',
      assignee_id: B.members[0],
      created_by_id: B.members[0],
      rule: 'once',
      due_date: '2030-02-02',
    })
    expect(denied(r1.error), 'insert directo en B pasó')
    const r2 = await a
      .from('interaction')
      .insert({ family_id: B.familyId, member_id: B.members[0], device: 'phone', kind: 'open' })
    expect(denied(r2.error), 'interaction en B pasó')
    const r3 = await a.rpc('rpc_create_task', {
      p_task: { title: 'x', assignee_id: B.members[0], rule: 'once', due_date: '2030-02-02' },
      p_actor: B.members[0],
      p_device: 'phone',
    })
    expect(denied(r3.error), 'rpc con actor de B pasó')
    const r4 = await a.from('member').update({ nickname: 'Hack' }).eq('id', B.members[0]!).select()
    expect(!r4.error && (r4.data?.length ?? 0) === 0, 'update de miembro ajeno pasó')
    const after = await must(
      admin.from('member').select('nickname').eq('id', B.members[0]!).single(),
      'verify',
    )
    expect(after.nickname === 'Uno', 'el apodo ajeno cambió')
  })

  await check('create_family falla si ya existe una familia', async () => {
    const args = { p_name: 'Otra', p_time_zone: 'UTC', p_members: [{ nickname: 'X', color: 'blue' }] }
    expect(denied((await a.rpc('create_family', args)).error), 'create_family no falló')
    expect(
      denied((await userD.client.rpc('create_family', args)).error),
      'create_family de usuario sin miembro no falló',
    )
  })

  await check('claim_member: código malo falla; bueno liga; no se reclama dos veces', async () => {
    const target = A.members[1]!
    const bad = await userC.client.rpc('claim_member', { p_member: target, p_code: 'NOPE00' })
    expect(denied(bad.error), 'código malo pasó')
    const good = await userC.client.rpc('claim_member', { p_member: target, p_code: A.code })
    expect(!good.error, `código bueno falló: ${good.error?.message}`)
    const row = await must(admin.from('member').select('auth_user_id').eq('id', target).single(), 'verify')
    expect(row.auth_user_id === userC.id, 'no quedó ligado')
    const seen = await must(userC.client.from('task').select('id'), 'C select')
    expect(seen.length >= 2, 'tras reclamar C no ve su familia')
    const again = await userD.client.rpc('claim_member', { p_member: target, p_code: A.code })
    expect(denied(again.error), 'segundo reclamo pasó')
    const twice = await userC.client.rpc('claim_member', { p_member: A.members[2]!, p_code: A.code })
    expect(denied(twice.error), 'una cuenta reclamó dos miembros')
  })

  await check('rpc_complete dos veces: una sola fila y un solo evento', async () => {
    const args = {
      p_task_id: A.taskId,
      p_date: '2030-01-10',
      p_late: false,
      p_for_other: false,
      p_actor: actorA,
      p_device: 'wall',
    }
    await must(a.rpc('rpc_complete', args), 'complete 1')
    await must(a.rpc('rpc_complete', args), 'complete 2')
    const comp = await must(admin.from('completion').select('*').eq('task_id', A.taskId), 'completions')
    expect(comp.length === 1, `completion: ${comp.length}`)
    const ev = await must(
      admin.from('event_log').select('*').eq('task_id', A.taskId).eq('type', 'completed'),
      'events',
    )
    expect(ev.length === 1, `eventos completed: ${ev.length}`)
    expect(ev[0]!.actor_id === actorA && ev[0]!.device === 'wall', 'evento con actor/device incorrectos')
  })

  await check('un usuario sin miembro ni equipo no ve nada', async () => {
    for (const t of [
      'family',
      'member',
      'task',
      'occurrence_override',
      'completion',
      'event_log',
      'interaction',
      'wall_device',
    ]) {
      const r = await userD.client.from(t).select('*')
      expect(!r.error && (r.data?.length ?? 0) === 0, `D ve filas de ${t}`)
    }
    const anon = createClient(url!, publishable!, opts)
    const r = await anon.from('task').select('*')
    expect(denied(r.error) || (r.data?.length ?? 0) === 0, 'anon ve tareas')
    const w = await userD.client.rpc('rpc_complete', {
      p_task_id: A.taskId,
      p_date: '2030-01-11',
      p_late: false,
      p_for_other: false,
      p_actor: actorA,
      p_device: 'phone',
    })
    expect(denied(w.error), 'D completó una tarea ajena')
  })

  await check('insertar directo en task (sin RPC) → error de RLS', async () => {
    const own = {
      family_id: A.familyId,
      title: 'directo',
      assignee_id: actorA,
      created_by_id: actorA,
      rule: 'once',
      due_date: '2030-03-03',
    }
    expect(denied((await a.from('task').insert(own)).error), 'insert directo en task pasó')
    expect(
      denied(
        (
          await a.from('completion').insert({
            task_id: A.taskId,
            occurrence_date: '2030-03-03',
            family_id: A.familyId,
            completed_by_id: actorA,
            late: false,
          })
        ).error,
      ),
      'insert en completion pasó',
    )
    expect(
      denied(
        (
          await a.from('occurrence_override').insert({
            task_id: A.taskId,
            occurrence_date: '2030-03-03',
            family_id: A.familyId,
            deleted: true,
          })
        ).error,
      ),
      'insert en override pasó',
    )
    expect(
      denied(
        (
          await a
            .from('event_log')
            .insert({ family_id: A.familyId, actor_id: actorA, type: 'created', device: 'phone' })
        ).error,
      ),
      'insert en event_log pasó',
    )
    const upd = await a.from('task').update({ title: 'hack' }).eq('id', A.taskId).select()
    expect(denied(upd.error) || (upd.data?.length ?? 0) === 0, 'update directo de task pasó')
    const del = await a.from('task').delete().eq('id', A.taskId).select()
    expect(denied(del.error) || (del.data?.length ?? 0) === 0, 'delete directo de task pasó')
    const still = await must(admin.from('task').select('title').eq('id', A.taskId).single(), 'verify')
    expect(still.title === 'Tarea A', 'la tarea cambió')
  })

  await check('rpc_move escribe override y evento; si el evento falla no queda el override', async () => {
    await must(
      a.rpc('rpc_move', {
        p_task_id: A.weeklyId,
        p_date: '2030-01-07',
        p_target: '2030-01-08',
        p_actor: actorA,
        p_device: 'phone',
      }),
      'move ok',
    )
    const ov = await must(
      admin
        .from('occurrence_override')
        .select('*')
        .eq('task_id', A.weeklyId)
        .eq('occurrence_date', '2030-01-07'),
      'override',
    )
    expect(ov.length === 1 && ov[0]!.moved_to === '2030-01-08' && ov[0]!.moved_by_id === actorA, 'override incorrecto')
    const ev = await must(
      admin.from('event_log').select('*').eq('task_id', A.weeklyId).eq('type', 'moved'),
      'moved events',
    )
    expect(ev.length === 1, `eventos moved: ${ev.length}`)
    const bad = await a.rpc('rpc_move', {
      p_task_id: A.weeklyId,
      p_date: '2030-01-09',
      p_target: '2030-01-10',
      p_actor: actorA,
      p_device: 'tablet',
    })
    expect(denied(bad.error), 'el device inválido no falló')
    const gone = await must(
      admin
        .from('occurrence_override')
        .select('*')
        .eq('task_id', A.weeklyId)
        .eq('occurrence_date', '2030-01-09'),
      'override 2',
    )
    expect(gone.length === 0, 'quedó el override tras el fallo')
  })

  const ymdIn = (tz: string, plusDays: number): string => {
    const d = new Date(Date.now() + plusDays * 86_400_000)
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)
  }
  const hourIn = (tz: string): number =>
    Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  // Etc/GMT+N es UTC-N: de Etc/GMT+12 a Etc/GMT-11 cubre todas las horas locales.
  const zones = Array.from({ length: 24 }, (_, i) => (i < 12 ? `Etc/GMT+${i}` : `Etc/GMT-${i - 11}`))
  const early = zones.find((z) => hourIn(z) >= 1 && hourIn(z) <= 8)!
  const lateZone = zones.find((z) => hourIn(z) >= 11 && hourIn(z) <= 22)!
  const setZone = (tz: string) =>
    must(admin.from('family').update({ time_zone: tz }).eq('id', A.familyId), 'set tz')
  const onceTask = async (title: string, due: string): Promise<string> =>
    (
      await must(
        admin
          .from('task')
          .insert({ family_id: A.familyId, title, assignee_id: actorA, created_by_id: actorA, rule: 'once', due_date: due })
          .select('id')
          .single(),
        'insert once',
      )
    ).id
  const complete = (task: string, date: string, lateFlag = false) =>
    a.rpc('rpc_complete', {
      p_task_id: task,
      p_date: date,
      p_late: lateFlag,
      p_for_other: false,
      p_actor: actorA,
      p_device: 'phone',
    })

  await check('marcar: tras el corte falla; antes del corte es tarde y lo fija el servidor', async () => {
    await setZone(lateZone)
    const yLate = await onceTask('ayer-tarde', ymdIn(lateZone, -1))
    expect(denied((await complete(yLate, ymdIn(lateZone, -1), true)).error), 'ayer pasadas las 10:00 pasó')
    await setZone(early)
    const old = await onceTask('antier', ymdIn(early, -2))
    expect(denied((await complete(old, ymdIn(early, -2))).error), 'hace dos días pasó')
    const y = await onceTask('ayer-temprano', ymdIn(early, -1))
    const ok = await complete(y, ymdIn(early, -1), false)
    expect(!ok.error, `ayer antes de las 10:00 falló: ${ok.error?.message}`)
    const row = await must(admin.from('completion').select('late').eq('task_id', y).single(), 'row')
    expect(row.late === true, 'late no lo fijó el servidor')
    const ev = await must(
      admin.from('event_log').select('payload').eq('task_id', y).eq('type', 'completed').single(),
      'ev',
    )
    expect((ev.payload as { late: boolean }).late === true, 'evento sin late')
    const today = await onceTask('hoy', ymdIn(early, 0))
    expect(!(await complete(today, ymdIn(early, 0), true)).error, 'hoy falló')
    const r2 = await must(admin.from('completion').select('late').eq('task_id', today).single(), 'row2')
    expect(r2.late === false, 'hoy quedó como tarde por p_late')
    await setZone('UTC')
  })

  await check('marcar una fecha en que la tarea no ocurre falla', async () => {
    expect(denied((await complete(A.weeklyId, '2030-01-03')).error), 'jueves (no programado) pasó')
    expect(denied((await complete(A.taskId, '2030-01-11')).error), 'fecha distinta a la de la tarea pasó')
    await must(
      a.rpc('rpc_delete_occurrence', { p_task_id: A.weeklyId, p_date: '2030-01-14', p_actor: actorA, p_device: 'phone' }),
      'del occ',
    )
    expect(denied((await complete(A.weeklyId, '2030-01-14')).error), 'ocurrencia borrada pasó')
  })

  await check('rpc_move: mismo día, día con la misma tarea, no ocurrencia y destino nulo fallan', async () => {
    const mv = (date: string, target: string | null) =>
      a.rpc('rpc_move', { p_task_id: A.weeklyId, p_date: date, p_target: target, p_actor: actorA, p_device: 'phone' })
    expect(denied((await mv('2030-01-16', '2030-01-16')).error), 'mismo día pasó')
    expect(denied((await mv('2030-01-16', null)).error), 'destino nulo pasó')
    expect(denied((await mv('2030-01-15', '2030-01-17')).error), 'no ocurrencia (martes 15) pasó')
    expect(denied((await mv('2030-01-16', '2030-01-21')).error), 'destino con la misma tarea (lunes 21) pasó')
    expect(denied((await mv('2030-01-16', '2030-01-08')).error), 'destino con ocurrencia movida pasó')
    expect(!(await mv('2030-01-16', '2030-01-17')).error, 'un movimiento válido falló')
  })

  await check('tarea de otra familia: rpc_complete y rpc_move fallan y B queda vacía', async () => {
    const c = await a.rpc('rpc_complete', {
      p_task_id: B.taskId, p_date: '2030-01-10', p_late: false, p_for_other: false, p_actor: actorA, p_device: 'phone',
    })
    expect(denied(c.error), 'complete de tarea ajena pasó')
    const m = await a.rpc('rpc_move', {
      p_task_id: B.weeklyId, p_date: '2030-01-07', p_target: '2030-01-08', p_actor: actorA, p_device: 'phone',
    })
    expect(denied(m.error), 'move de tarea ajena pasó')
    const comp = await must(admin.from('completion').select('task_id').eq('family_id', B.familyId), 'comp B')
    const ov = await must(admin.from('occurrence_override').select('task_id').eq('family_id', B.familyId), 'ov B')
    const ev = await must(admin.from('event_log').select('id').eq('family_id', B.familyId), 'ev B')
    expect(comp.length === 0 && ov.length === 0 && ev.length === 0, 'B tiene escrituras de A')
  })

  await check('time_zone inválida se rechaza en update directo', async () => {
    expect(
      denied((await a.from('family').update({ time_zone: 'Mars/Phobos' }).eq('id', A.familyId)).error),
      'zona inválida pasó',
    )
    const good = await a.from('family').update({ time_zone: 'UTC' }).eq('id', A.familyId).select()
    expect(!good.error && good.data?.length === 1, 'zona válida falló')
  })

  await check('un miembro inactivo pierde el acceso', async () => {
    await must(admin.from('member').update({ active: false }).eq('id', actorA), 'deactivate')
    try {
      const t = await a.from('task').select('id')
      expect(!t.error && (t.data?.length ?? 0) === 0, 'inactivo sigue viendo tareas')
      expect(denied((await complete(A.weeklyId, '2030-01-17')).error), 'inactivo escribió')
    } finally {
      await must(admin.from('member').update({ active: true }).eq('id', actorA), 'reactivate')
    }
    const back = await must(a.from('task').select('id'), 'back')
    expect(back.length > 0, 'no volvió el acceso')
  })
}

let crashed: unknown = null
try {
  await main()
} catch (e) {
  crashed = e
} finally {
  try {
    await cleanup()
  } catch (e) {
    console.error('Limpieza incompleta:', e instanceof Error ? e.message : e)
  }
}

if (crashed) {
  console.error('FAIL (setup):', crashed instanceof Error ? crashed.message : crashed)
  process.exit(1)
}
const passed = results.filter((r) => r.ok).length
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
if (passed === results.length) console.log(`RLS OK (${passed}/${results.length})`)
else {
  console.error(`RLS FAIL (${passed}/${results.length})`)
  process.exit(1)
}
