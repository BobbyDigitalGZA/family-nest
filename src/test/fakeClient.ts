import type { DataClient, QueryLike, QueryResult } from '../data/client'

type Row = Record<string, unknown>
type Listener = () => void

/** In-memory stand-in for the Supabase client, for repository and realtime tests. */
export function makeFakeClient() {
  const calls: { fn: string; args: Row }[] = []
  const tables = new Map<string, Row[]>()
  const listeners = new Map<string, Set<Listener>>()
  const inserted: { table: string; row: Row }[] = []
  const names: string[] = []
  const updated: { table: string; values: Row; filters: Row }[] = []
  const bounds: { table: string; op: string; col: string; val: string }[] = []
  const rpcData = new Map<string, unknown>()
  let rpcError: string | null = null

  const client: DataClient = {
    rpc(fn, args = {}) {
      calls.push({ fn, args })
      const res: QueryResult = rpcError
        ? { data: null, error: { message: rpcError } }
        : { data: rpcData.get(fn) ?? null, error: null }
      return Promise.resolve(res)
    },
    from(table) {
      let rows = [...(tables.get(table) ?? [])]
      const q: QueryLike = {
        eq(col: string, val: unknown) {
          rows = rows.filter((r) => r[col] === val)
          return q
        },
        gte(col: string, val: string) {
          bounds.push({ table, op: 'gte', col, val })
          rows = rows.filter((r) => Date.parse(String(r[col])) >= Date.parse(val))
          return q
        },
        lt(col: string, val: string) {
          bounds.push({ table, op: 'lt', col, val })
          rows = rows.filter((r) => Date.parse(String(r[col])) < Date.parse(val))
          return q
        },
        order() {
          return q
        },
        // Thenable on purpose, like the real query builder.
        then(ok, bad) {
          return Promise.resolve({ data: rows, error: null } as QueryResult).then(ok, bad)
        },
      }
      return {
        select: () => q,
        update(values: Row) {
          const entry = { table, values, filters: {} as Row }
          updated.push(entry)
          const u: QueryLike = {
            eq(col: string, val: unknown) {
              entry.filters[col] = val
              return u
            },
            gte() {
              return u
            },
            lt() {
              return u
            },
            order() {
              return u
            },
            then(ok, bad) {
              return Promise.resolve({ data: null, error: null } as QueryResult).then(ok, bad)
            },
          }
          return u
        },
        insert(row: Row) {
          inserted.push({ table, row })
          return Promise.resolve({ data: null, error: null } as QueryResult)
        },
      }
    },
    channel(name) {
      names.push(name)
      const mine: { table: string; cb: Listener }[] = []
      const ch = {
        on(_t: 'postgres_changes', f: { table: string }, cb: Listener) {
          mine.push({ table: f.table, cb })
          const set = listeners.get(f.table) ?? new Set<Listener>()
          set.add(cb)
          listeners.set(f.table, set)
          return ch
        },
        subscribe() {
          return ch
        },
        _mine: mine,
      }
      return ch
    },
    removeChannel(ch) {
      const mine = (ch as unknown as { _mine: { table: string; cb: Listener }[] })._mine
      for (const m of mine) listeners.get(m.table)?.delete(m.cb)
      return Promise.resolve('ok')
    },
  }

  return {
    client,
    rpcCalls: (fn: string): Row[] => calls.filter((c) => c.fn === fn).map((c) => c.args),
    bounds: (table: string) => bounds.filter((b) => b.table === table),
    updates: (table: string) => updated.filter((u) => u.table === table),
    setRpcData: (fn: string, data: unknown) => void rpcData.set(fn, data),
    inserts: (table: string): Row[] => inserted.filter((i) => i.table === table).map((i) => i.row),
    channelNames: () => [...names],
    setTable: (name: string, rows: Row[]) => void tables.set(name, rows),
    failRpc: (message: string) => void (rpcError = message),
    emit: (table: string) => listeners.get(table)?.forEach((cb) => cb()),
    listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  }
}
