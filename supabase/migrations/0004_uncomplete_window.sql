-- ---------------------------------------------------------------------------
-- rpc_uncomplete: desmarcar sigue la misma ventana que marcar. Se juzga por el
-- día efectivo de la ocurrencia (moved_to si se movió) y family.late_mark_until;
-- fuera de la ventana falla con 'locked'. Misma firma, mismo alcance por familia,
-- mismo evento y mismos permisos que en 0001.
-- ---------------------------------------------------------------------------

create or replace function public.rpc_uncomplete(p_task_id uuid, p_date date, p_actor uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  t public.task := public._live_task(p_task_id, v_family);
  v_rows int;
  v_tz text;
  v_cutoff time;
  v_now timestamp;
  v_eff date;
begin
  select time_zone, late_mark_until into v_tz, v_cutoff from public.family where id = v_family;
  v_now := now() at time zone v_tz;
  select coalesce(o.moved_to, p_date) into v_eff
    from (select 1) x
    left join public.occurrence_override o
      on o.task_id = p_task_id and o.occurrence_date = p_date;
  if not (v_eff >= v_now::date
          or (v_eff = v_now::date - 1 and v_now::time < v_cutoff)) then
    raise exception 'locked' using errcode = 'P0001';
  end if;
  delete from public.completion
   where task_id = p_task_id and occurrence_date = p_date and family_id = v_family;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    perform public._log_event(v_family, p_actor, 'uncompleted', p_task_id, p_date, p_device, '{}');
  end if;
end;
$$;
