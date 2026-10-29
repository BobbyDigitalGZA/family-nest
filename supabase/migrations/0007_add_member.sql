-- ---------------------------------------------------------------------------
-- Family Nest 0007 · agregar miembros a una familia ya creada.
--   1. add_member: cualquier cuenta de la familia (miembro o pantalla de la casa) agrega
--      un miembro sin cuenta ligada; la persona lo reclama después con el código de unión.
--      Valida apodo (1 a 24 caracteres tras quitar espacios) y color (clave en minúsculas),
--      y lo pone al final del orden.
--   2. Un apodo no se repite entre los miembros activos de una familia (sin distinguir
--      mayúsculas ni espacios de los bordes): índice único parcial, que también cubre
--      create_family y el cambio de apodo por el grant de columnas de member.
-- ---------------------------------------------------------------------------

create unique index member_nickname_active_uq
  on public.member (family_id, lower(btrim(nickname)))
  where active;

create function public.add_member(p_nickname text, p_color text, p_birthday date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public.current_family_id();
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not-authenticated' using errcode = '42501';
  end if;
  if v_family is null then
    raise exception 'not-a-member' using errcode = '42501';
  end if;
  if length(v_nickname) not between 1 and 24 then
    raise exception 'nickname-invalid';
  end if;
  if p_color is null or p_color !~ '^[a-z][a-z0-9-]{0,23}$' then
    raise exception 'color-invalid';
  end if;
  -- Dos altas a la vez no se llevan el mismo lugar en el orden.
  perform pg_advisory_xact_lock(hashtext('family-nest:add_member:' || v_family::text));
  if exists (
    select 1 from public.member
     where family_id = v_family and active and lower(btrim(nickname)) = lower(v_nickname)
  ) then
    raise exception 'nickname-taken';
  end if;
  insert into public.member (family_id, nickname, color, birthday, sort_order)
  values (
    v_family,
    v_nickname,
    p_color,
    p_birthday,
    coalesce((select max(sort_order) + 1 from public.member where family_id = v_family), 0)
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.add_member(text, text, date) from public, anon;
grant execute on function public.add_member(text, text, date) to authenticated;
