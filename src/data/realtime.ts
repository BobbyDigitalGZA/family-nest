import { getClient } from './client'

const TABLES = ['task', 'occurrence_override', 'completion', 'member'] as const

/** Calls onChange for any change in the family data; returns the unsubscribe. */
export function subscribeFamily(onChange: () => void): () => void {
  const client = getClient()
  let channel = client.channel('family-nest')
  for (const table of TABLES) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
  }
  channel.subscribe()
  return () => {
    void client.removeChannel(channel)
  }
}
