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

-- ---------------------------------------------------------------------------
-- family_exists: tras iniciar sesión, la app decide entre Configurar y Unirse.
-- Solo devuelve un booleano (no revela datos de la familia).
-- ---------------------------------------------------------------------------

create function public.family_exists() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.family)
$$;

revoke all on function public.family_exists() from public, anon;
grant execute on function public.family_exists() to authenticated;

-- ---------------------------------------------------------------------------
-- create_family con país de los festivos, atómico: una sola versión de la función.
-- ---------------------------------------------------------------------------

drop function public.create_family(text, text, jsonb);

create function public.create_family(
  p_name text, p_time_zone text, p_members jsonb, p_country_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_family uuid;
  v_code text;
  v_id uuid;
  m jsonb;
  i int := 0;
begin
  if v_uid is null then
    raise exception 'not-authenticated' using errcode = '42501';
  end if;
  if p_country_code is null or p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'invalid-country';
  end if;
  perform pg_advisory_xact_lock(hashtext('family-nest:create_family'));
  if exists (select 1 from public.family) then
    raise exception 'family-already-exists';
  end if;
  if p_time_zone is null or not exists (select 1 from pg_timezone_names where name = p_time_zone) then
    raise exception 'invalid-time-zone';
  end if;
  if p_members is null or jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) = 0 then
    raise exception 'members-required';
  end if;

  v_code := public._new_join_code();
  insert into public.family (name, time_zone, join_code, country_code)
  values (p_name, p_time_zone, v_code, p_country_code)
  returning id into v_family;

  -- El primer miembro de la lista es quien llama (queda ligado a su cuenta).
  for m in select * from jsonb_array_elements(p_members) loop
    insert into public.member (family_id, nickname, color, birthday, sort_order, auth_user_id)
    values (
      v_family,
      m ->> 'nickname',
      coalesce(m ->> 'color', 'blue'),
      nullif(m ->> 'birthday', '')::date,
      i,
      case when i = 0 then v_uid else null end
    )
    returning id into v_id;
    i := i + 1;
  end loop;

  return v_code;
end;
$$;

revoke all on function public.create_family(text, text, jsonb, text) from public, anon;
grant execute on function public.create_family(text, text, jsonb, text) to authenticated;
