import { createClient } from '@supabase/supabase-js'

export interface DbError {
  message: string
}
export interface QueryResult {
  data: unknown
  error: DbError | null
}

export interface QueryLike extends PromiseLike<QueryResult> {
  eq(column: string, value: unknown): QueryLike
  order(column: string, opts?: { ascending?: boolean }): QueryLike
}

export interface ChannelLike {
  on(
    type: 'postgres_changes',
    filter: { event: '*'; schema: 'public'; table: string },
    cb: () => void,
  ): ChannelLike
  subscribe(): unknown
}

/** The slice of the Supabase client the app uses; tests inject a fake. */
export interface DataClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<QueryResult>
  from(table: string): {
    select(columns?: string): QueryLike
    /** Only `interaction` is written directly; everything else goes through RPCs. */
    insert(row: Record<string, unknown>): PromiseLike<QueryResult>
  }
  channel(name: string): ChannelLike
  removeChannel(channel: ChannelLike): PromiseLike<unknown>
}

let client: DataClient | null = null

export function getClient(): DataClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  if (!url || !key) throw new Error('supabase-env-missing')
  client = createClient(url, key) as unknown as DataClient
  return client
}

export function setClientForTests(fake: DataClient | null): void {
  client = fake
}
