import { t, type TKey } from '../../i18n/es'

const BY_CODE: [string, TKey][] = [
  ['not-authenticated', 'errNotAuthenticated'],
  ['family-already-exists', 'errFamilyExists'],
  ['invalid-time-zone', 'errInvalidTimeZone'],
  ['members-required', 'errMembersRequired'],
  ['already-linked', 'errAlreadyLinked'],
  ['invalid-claim', 'errInvalidClaim'],
  ['invalid-code', 'errInvalidCode'],
  ['invalid-country', 'errInvalidCountry'],
]

/** Traduce el error de una RPC a un mensaje en español para mostrar a la persona. */
export function errorText(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  const hit = BY_CODE.find(([code]) => message.includes(code))
  return t(hit ? hit[1] : 'errGeneric')
}
