-- ---------------------------------------------------------------------------
-- Family Nest 0007 · miembros de una familia ya creada.
--   1. Un apodo no se repite entre los miembros activos de una familia (sin distinguir
--      mayúsculas ni espacios de los bordes): índice único parcial, que también cubre
--      create_family.
--   2. add_member: quien actúa (p_actor, de la familia del llamador) agrega un miembro sin
--      cuenta ligada; la persona lo reclama después con el código de unión. Va al final
--      del orden.
--   3. update_member: cambia apodo y color con las mismas validaciones.
--   4. remove_member: desactiva a un miembro y suelta su cuenta (auth_user_id = null), para
--      que esa cuenta pueda volver a unirse. Nadie se quita a sí mismo (ni el actor ni el
--      miembro de la cuenta que llama) y la familia nunca queda sin miembros activos.
--   5. Apodo, color y baja ya no se escriben directo: se quita ese grant de columnas.
-- Ninguna de estas acciones va al event_log (es configuración, no una tarea).
-- ---------------------------------------------------------------------------

create unique index member_nickname_active_uq
  on public.member (family_id, lower(btrim(nickname)))
  where active;

revoke update (nickname, color, active) on public.member from authenticated;

-- Validaciones comunes de apodo y color; devuelve el apodo sin espacios en los bordes.
create function public._member_fields(p_nickname text, p_color text) returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_nickname text := btrim(coalesce(p_nickname, ''));
begin
  if length(v_nickname) not between 1 and 24 then
    raise exception 'nickname-invalid';
  end if;
  if p_color is null or p_color !~ '^[a-z][a-z0-9-]{0,23}$' then
    raise exception 'color-invalid';
  end if;
  return v_nickname;
end;
$$;

create function public._nickname_free(p_family uuid, p_nickname text, p_except uuid) returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if exists (
    select 1 from public.member
     where family_id = p_family and active and id is distinct from p_except
       and lower(btrim(nickname)) = lower(p_nickname)
  ) then
    raise exception 'nickname-taken';
  end if;
end;
$$;

create function public.add_member(p_nickname text, p_color text, p_birthday date, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  v_nickname text := public._member_fields(p_nickname, p_color);
  v_id uuid;
begin
  -- Altas, cambios y bajas de una familia van de a una: orden y apodos sin carreras.
  perform pg_advisory_xact_lock(hashtext('family-nest:members:' || v_family::text));
  perform public._nickname_free(v_family, v_nickname, null);
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

create function public.update_member(p_member uuid, p_nickname text, p_color text, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  v_nickname text := public._member_fields(p_nickname, p_color);
begin
  perform pg_advisory_xact_lock(hashtext('family-nest:members:' || v_family::text));
  perform public._nickname_free(v_family, v_nickname, p_member);
  update public.member
     set nickname = v_nickname, color = p_color
   where id = p_member and family_id = v_family and active;
  if not found then
    raise exception 'not-a-member' using errcode = '42501';
  end if;
end;
$$;

create function public.remove_member(p_member uuid, p_actor uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
begin
  perform pg_advisory_xact_lock(hashtext('family-nest:members:' || v_family::text));
  if p_member = p_actor
     or exists (select 1 from public.member where id = p_member and auth_user_id = auth.uid()) then
    raise exception 'remove-self';
  end if;
  if (select count(*) from public.member where family_id = v_family and active and id <> p_member) = 0 then
    raise exception 'remove-last';
  end if;
  update public.member
     set active = false, auth_user_id = null
   where id = p_member and family_id = v_family and active;
  if not found then
    raise exception 'not-a-member' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public._member_fields(text, text), public._nickname_free(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function
  public.add_member(text, text, date, uuid),
  public.update_member(uuid, text, text, uuid),
  public.remove_member(uuid, uuid)
  from public, anon;
grant execute on function
  public.add_member(text, text, date, uuid),
  public.update_member(uuid, text, text, uuid),
  public.remove_member(uuid, uuid)
  to authenticated;
