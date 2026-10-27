-- ---------------------------------------------------------------------------
-- rpc_move: una ocurrencia cuya ventana de marcar ya cerró no se puede mover
-- (si no, se adelantaría a hoy y se marcaría sin "tarde"). Se juzga por el día
-- efectivo de la ocurrencia (moved_to si se movió) y family.late_mark_until,
-- igual que rpc_complete (0002) y rpc_uncomplete (0004); fuera de la ventana
-- falla con 'locked'. Misma firma, mismas validaciones, mismo evento y mismos
-- permisos que en 0001.
-- ---------------------------------------------------------------------------

create or replace function public.rpc_move(p_task_id uuid, p_date date, p_target date, p_actor uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  t public.task := public._live_task(p_task_id, v_family);
  v_tz text;
  v_cutoff time;
  v_now timestamp;
  v_eff date;
begin
  -- espejo de canMoveOccurrence
  if p_target is null or p_date is null then
    raise exception 'target-required' using errcode = 'P0001';
  end if;
  if not public._occurs_on(p_task_id, p_date) then
    raise exception 'not-an-occurrence' using errcode = 'P0001';
  end if;
  -- ventana de marcar de la ocurrencia que se mueve
  select time_zone, late_mark_until into v_tz, v_cutoff from public.family where id = v_family;
  v_now := now() at time zone v_tz;
  v_eff := coalesce((select o.moved_to from public.occurrence_override o
                      where o.task_id = p_task_id and o.occurrence_date = p_date), p_date);
  if not (v_eff >= v_now::date
          or (v_eff = v_now::date - 1 and v_now::time < v_cutoff)) then
    raise exception 'locked' using errcode = 'P0001';
  end if;
  if p_target = v_eff then
    raise exception 'same-date' using errcode = 'P0001';
  end if;
  if public._has_occurrence_on(p_task_id, p_target) then
    raise exception 'already-occurs' using errcode = 'P0001';
  end if;
  insert into public.occurrence_override (task_id, occurrence_date, family_id, moved_to, moved_at, moved_by_id)
  values (p_task_id, p_date, v_family, p_target, now(), p_actor)
  on conflict (task_id, occurrence_date) do update
    set moved_to = excluded.moved_to, moved_at = excluded.moved_at, moved_by_id = excluded.moved_by_id;
  perform public._log_event(v_family, p_actor, 'moved', p_task_id, p_date, p_device,
    jsonb_build_object('from', p_date, 'to', p_target));
end;
$$;
