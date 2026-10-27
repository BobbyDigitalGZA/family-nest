import { getClient } from './client'

let counter = 0

const TABLES = ['task', 'occurrence_override', 'completion', 'member'] as const

/** Each call gets its own channel name, so StrictMode double mounts never reuse a live channel. */
/** Calls onChange for any change in the family data; returns the unsubscribe. */
export function subscribeFamily(onChange: () => void): () => void {
  const client = getClient()
  let channel = client.channel(`family-nest-${++counter}`)
  for (const table of TABLES) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
  }
  channel.subscribe()
  return () => {
    void client.removeChannel(channel)
  }
}
