import { getClient, type QueryResult } from './client'

// Miembros de una familia ya creada: alta por RPC (add_member) y cambio de apodo, color o
// baja por el grant de columnas de member. El apodo no se repite entre los activos (índice
// member_nickname_active_uq).

function unwrap(res: QueryResult): unknown {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

export interface AddMemberInput {
  nickname: string
  color: string
  birthday: string | null
}

/** Agrega un miembro sin cuenta ligada; la persona lo reclama con el código de unión. */
export async function addMember(input: AddMemberInput): Promise<string> {
  const data = unwrap(
    await getClient().rpc('add_member', {
      p_nickname: input.nickname,
      p_color: input.color,
      p_birthday: input.birthday,
    }),
  )
  if (typeof data !== 'string' || data === '') throw new Error('member-missing')
  return data
}

export interface MemberPatch {
  nickname?: string
  color?: string
  active?: boolean
}

export async function updateMember(memberId: string, patch: MemberPatch): Promise<void> {
  unwrap(await getClient().from('member').update({ ...patch }).eq('id', memberId))
}
