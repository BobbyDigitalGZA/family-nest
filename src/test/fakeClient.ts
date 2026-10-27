import type { DataClient, QueryLike, QueryResult } from '../data/client'

type Row = Record<string, unknown>
type Listener = () => void

/** In-memory stand-in for the Supabase client, for repository and realtime tests. */
export function makeFakeClient() {
  const calls: { fn: string; args: Row }[] = []
  const tables = new Map<string, Row[]>()
  const listeners = new Map<string, Set<Listener>>()
  const inserted: { table: string; row: Row }[] = []
  let rpcError: string | null = null

  const client: DataClient = {
    rpc(fn, args = {}) {
      calls.push({ fn, args })
      const res: QueryResult = rpcError
        ? { data: null, error: { message: rpcError } }
        : { data: null, error: null }
      return Promise.resolve(res)
    },
    from(table) {
      let rows = [...(tables.get(table) ?? [])]
      const q: QueryLike = {
        eq(col: string, val: unknown) {
          rows = rows.filter((r) => r[col] === val)
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
        insert(row: Row) {
          inserted.push({ table, row })
          return Promise.resolve({ data: null, error: null } as QueryResult)
        },
      }
    },
    channel() {
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
    inserts: (table: string): Row[] => inserted.filter((i) => i.table === table).map((i) => i.row),
    setTable: (name: string, rows: Row[]) => void tables.set(name, rows),
    failRpc: (message: string) => void (rpcError = message),
    emit: (table: string) => listeners.get(table)?.forEach((cb) => cb()),
    listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  }
}
