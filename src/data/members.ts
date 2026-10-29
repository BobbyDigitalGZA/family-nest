import { getClient, type QueryResult } from './client'

// Miembros de una familia ya creada: alta, cambio de apodo o color, y baja. Todo por RPC
// (0007), con quien actúa; la base valida apodo y color, que el apodo no se repita entre
// los activos, que nadie se quite a sí mismo y que la familia no quede vacía.

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
export async function addMember(input: AddMemberInput, actorId: string): Promise<string> {
  const data = unwrap(
    await getClient().rpc('add_member', {
      p_nickname: input.nickname,
      p_color: input.color,
      p_birthday: input.birthday,
      p_actor: actorId,
    }),
  )
  if (typeof data !== 'string' || data === '') throw new Error('member-missing')
  return data
}

export async function updateMember(
  memberId: string,
  patch: { nickname: string; color: string },
  actorId: string,
): Promise<void> {
  unwrap(
    await getClient().rpc('update_member', {
      p_member: memberId,
      p_nickname: patch.nickname,
      p_color: patch.color,
      p_actor: actorId,
    }),
  )
}

/** Quita al miembro de la familia y suelta su cuenta, que puede volver a unirse con el código. */
export async function removeMember(memberId: string, actorId: string): Promise<void> {
  unwrap(await getClient().rpc('remove_member', { p_member: memberId, p_actor: actorId }))
}
