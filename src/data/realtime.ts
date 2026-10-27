import { getClient } from './client'

let counter = 0

const TABLES = ['family', 'task', 'occurrence_override', 'completion', 'member'] as const

/**
 * Calls onChange for any change in the family data, and whenever the app may have missed some:
 * when the channel (re)joins, after a channel error or timeout, when the page becomes visible
 * again and when the browser comes back online. Returns the unsubscribe.
 *
 * Each call gets its own channel name, so StrictMode double mounts never reuse a live channel.
 */
export function subscribeFamily(onChange: () => void): () => void {
  const client = getClient()
  let channel = client.channel(`family-nest-${++counter}`)
  for (const table of TABLES) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
  }
  let live = true
  channel.subscribe((status) => {
    if (!live) return
    // SUBSCRIBED also fires on every rejoin: whatever changed while disconnected is read now.
    if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onChange()
  })
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onChange)
  return () => {
    live = false
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onChange)
    void client.removeChannel(channel)
  }
}
