import type { DataClient, QueryLike, QueryResult } from '../data/client'

type Row = Record<string, unknown>
type Listener = () => void

/** PostgREST's default max_rows on Supabase: a response never carries more rows than this. */
export const MAX_ROWS = 1000

/** In-memory stand-in for the Supabase client, for repository and realtime tests. */
export function makeFakeClient() {
  const calls: { fn: string; args: Row }[] = []
  const tables = new Map<string, Row[]>()
  const listeners = new Map<string, Set<Listener>>()
  const inserted: { table: string; row: Row }[] = []
  const names: string[] = []
  const channels: Set<(status: string) => void>[] = []
  const updated: { table: string; values: Row; filters: Row }[] = []
  const bounds: { table: string; op: string; col: string; val: string }[] = []
  const rpcData = new Map<string, unknown>()
  const ranges: { table: string; from: number; to: number }[] = []
  let rpcError: string | null = null
  let readError: string | null = null

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
      const sortKeys: { col: string; asc: boolean }[] = []
      let span: [number, number] | null = null
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
        order(col: string, opts?: { ascending?: boolean }) {
          sortKeys.push({ col, asc: opts?.ascending !== false })
          return q
        },
        range(from: number, to: number) {
          ranges.push({ table, from, to })
          span = [from, to]
          return q
        },
        // Thenable on purpose, like the real query builder. Like PostgREST, never more than MAX_ROWS.
        then(ok, bad) {
          const sorted = [...rows].sort((x, y) => {
            for (const k of sortKeys) {
              const c = String(x[k.col]).localeCompare(String(y[k.col]), 'en', { numeric: true })
              if (c !== 0) return k.asc ? c : -c
            }
            return 0
          })
          const sliced = span ? sorted.slice(span[0], span[1] + 1) : sorted
          const res: QueryResult = readError
            ? { data: null, error: { message: readError } }
            : { data: sliced.slice(0, MAX_ROWS), error: null }
          return Promise.resolve(res).then(ok, bad)
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
            range() {
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
      const statusListeners = new Set<(status: string) => void>()
      channels.push(statusListeners)
      const ch = {
        on(_t: 'postgres_changes', f: { table: string }, cb: Listener) {
          mine.push({ table: f.table, cb })
          const set = listeners.get(f.table) ?? new Set<Listener>()
          set.add(cb)
          listeners.set(f.table, set)
          return ch
        },
        subscribe(cb?: (status: string) => void) {
          if (cb) statusListeners.add(cb)
          return ch
        },
        _status: () => statusListeners,
        _mine: mine,
      }
      return ch
    },
    removeChannel(ch) {
      const c = ch as unknown as { _mine: { table: string; cb: Listener }[]; _status: () => Set<unknown> }
      for (const m of c._mine) listeners.get(m.table)?.delete(m.cb)
      c._status().clear()
      return Promise.resolve('ok')
    },
  }

  return {
    client,
    rpcCalls: (fn: string): Row[] => calls.filter((c) => c.fn === fn).map((c) => c.args),
    ranges: (table: string) => ranges.filter((r) => r.table === table),
    bounds: (table: string) => bounds.filter((b) => b.table === table),
    updates: (table: string) => updated.filter((u) => u.table === table),
    setRpcData: (fn: string, data: unknown) => void rpcData.set(fn, data),
    inserts: (table: string): Row[] => inserted.filter((i) => i.table === table).map((i) => i.row),
    channelNames: () => [...names],
    setTable: (name: string, rows: Row[]) => void tables.set(name, rows),
    failRpc: (message: string) => void (rpcError = message),
    /** Every select fails with this message (null: reads work again). */
    failReads: (message: string | null) => void (readError = message),
    /** Reports a channel status (SUBSCRIBED, CHANNEL_ERROR, ...) to every live channel. */
    setStatus: (status: string) => channels.forEach((set) => set.forEach((cb) => cb(status))),
    emit: (table: string) => listeners.get(table)?.forEach((cb) => cb()),
    listenerCount: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  }
}
