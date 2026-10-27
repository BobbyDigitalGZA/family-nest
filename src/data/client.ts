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
  gte(column: string, value: string): QueryLike
  lt(column: string, value: string): QueryLike
  /** Chain several calls for a multi-column order (first call = primary key of the sort). */
  order(column: string, opts?: { ascending?: boolean }): QueryLike
  /** Rows from..to inclusive, by position in the ordered result. */
  range(from: number, to: number): QueryLike
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
    /** Only the configuration columns granted to members (family: country_code, ...). */
    update(values: Record<string, unknown>): QueryLike
  }
  channel(name: string): ChannelLike
  removeChannel(channel: ChannelLike): PromiseLike<unknown>
}

export interface SessionLike {
  user: { id: string }
}

/** The slice of Supabase Auth the sign-in flow uses; tests inject a fake. */
export interface AuthLike {
  getSession(): PromiseLike<{ data: { session: SessionLike | null }; error: DbError | null }>
  onAuthStateChange(cb: (event: string, session: SessionLike | null) => void): {
    data: { subscription: { unsubscribe(): void } }
  }
  signInWithOtp(args: { email: string }): PromiseLike<{ error: DbError | null }>
  verifyOtp(args: {
    email: string
    token: string
    type: 'email'
  }): PromiseLike<{ error: DbError | null }>
}

let client: DataClient | null = null
let rawAuth: AuthLike | null = null
let authOverride: AuthLike | null = null

export function getClient(): DataClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  if (!url || !key) throw new Error('supabase-env-missing')
  const created = createClient(url, key)
  rawAuth = created.auth as unknown as AuthLike
  client = created as unknown as DataClient
  return client
}

export function getAuth(): AuthLike {
  if (authOverride) return authOverride
  getClient()
  if (!rawAuth) throw new Error('supabase-auth-unavailable')
  return rawAuth
}

export function setAuthForTests(fake: AuthLike | null): void {
  authOverride = fake
}

export function setClientForTests(fake: DataClient | null): void {
  client = fake
}
