-- Reclamo de miembro: con el código de unión, la persona ve qué apodos siguen libres.
-- Solo devuelve id, apodo y color de miembros activos sin cuenta ligada de la familia
-- cuyo código se envía; un código malo da una lista vacía (no revela si existe).

create function public.list_claimable_members(p_code text)
returns table (id uuid, nickname text, color text)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.nickname, m.color
    from public.member m
    join public.family f on f.id = m.family_id
   where f.join_code = upper(btrim(p_code))
     and m.auth_user_id is null
     and m.active
   order by m.sort_order, m.nickname
$$;

revoke all on function public.list_claimable_members(text) from public, anon;
grant execute on function public.list_claimable_members(text) to authenticated;
