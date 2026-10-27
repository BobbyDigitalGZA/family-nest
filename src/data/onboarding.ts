import { getClient, type QueryResult } from './client'
import type { Row } from './mappers'

// Alta de familia, reclamo de miembro y registro de la pantalla de la casa.
// Todo va por las RPC de la base; aquí solo se arman los argumentos.

function unwrap(res: QueryResult): unknown {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

export interface NewMemberInput {
  nickname: string
  color: string
  birthday: string | null
}

export interface NewFamilyInput {
  name: string
  timeZone: string
  /** ISO 3166-1 alpha-2, mayúsculas. */
  countryCode: string
  members: NewMemberInput[]
}

export interface ClaimableMember {
  id: string
  nickname: string
  color: string
}

/** Crea la familia y devuelve el código de unión. */
export async function createFamily(input: NewFamilyInput): Promise<string> {
  const data = unwrap(
    await getClient().rpc('create_family', {
      p_name: input.name,
      p_time_zone: input.timeZone,
      p_members: input.members.map((m) => ({
        nickname: m.nickname,
        color: m.color,
        birthday: m.birthday,
      })),
    }),
  )
  if (typeof data !== 'string' || data === '') throw new Error('join-code-missing')
  return data
}

/** Guarda el país de los festivos por la vía de actualización de la familia (columna con grant). */
export async function saveFamilyCountry(countryCode: string): Promise<void> {
  const client = getClient()
  const found = unwrap(await client.from('family').select('id')) as Row[] | null
  const id = found?.[0]?.id
  if (id == null) throw new Error('family-not-found')
  unwrap(await client.from('family').update({ country_code: countryCode }).eq('id', String(id)))
}

export async function listClaimableMembers(code: string): Promise<ClaimableMember[]> {
  const data = unwrap(await getClient().rpc('list_claimable_members', { p_code: code }))
  return ((data as Row[] | null) ?? []).map((r) => ({
    id: String(r.id),
    nickname: String(r.nickname),
    color: String(r.color),
  }))
}

export async function claimMember(memberId: string, code: string): Promise<void> {
  unwrap(await getClient().rpc('claim_member', { p_member: memberId, p_code: code }))
}

export async function registerWallDevice(code: string, label: string): Promise<void> {
  unwrap(await getClient().rpc('register_wall_device', { p_code: code, p_label: label }))
}
