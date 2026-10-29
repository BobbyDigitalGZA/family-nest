-- ---------------------------------------------------------------------------
-- Family Nest 0006 · revisión final de la Fase 1.
--   1. _window_open: la ventana de marcar de un día (hoy, o ayer antes de
--      family.late_mark_until), en la zona horaria de la familia.
--   2. rpc_move: además de la ventana del origen (0005), el día destino debe tener
--      la ventana abierta ('past-target'): mover a un día pasado atraparía la tarea.
--   3. rpc_delete_occurrence: solo una ocurrencia que existe ('not-an-occurrence') y con
--      su ventana abierta ('locked'), igual que marcar, desmarcar y mover. rpc_excuse no
--      cambia (excusar después del hecho está permitido).
--   4. rpc_update_task: cambiar la persona o la repetición de una tarea repetida que ya
--      tuvo ocurrencias antes de hoy no reescribe el pasado: en la misma transacción la
--      serie vieja termina ayer y una copia empieza hoy con el cambio. Renombrar nunca
--      parte la serie. Una tarea de un día cuya ventana ya cerró no se reasigna ni se
--      convierte ('locked'). Ahora devuelve el id de la tarea que lleva la serie desde
--      hoy (el mismo si no se partió); por eso se borra y se vuelve a crear, con los
--      mismos argumentos y permisos.
--   5. Realtime también publica family (zona horaria, corte de marcar tarde).
-- ---------------------------------------------------------------------------

create function public._window_open(p_family uuid, p_day date) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p_day >= (now() at time zone f.time_zone)::date
        or (p_day = (now() at time zone f.time_zone)::date - 1
            and (now() at time zone f.time_zone)::time < f.late_mark_until)
      from public.family f
     where f.id = p_family
  ), false)
$$;

revoke all on function public._window_open(uuid, date) from public, anon, authenticated;

-- Día efectivo de una ocurrencia (moved_to si se movió).
create function public._effective_date(p_task_id uuid, p_original date) returns date
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select o.moved_to from public.occurrence_override o
                    where o.task_id = p_task_id and o.occurrence_date = p_original), p_original)
$$;

revoke all on function public._effective_date(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- rpc_move
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
  v_eff date;
begin
  -- espejo de mover() en src/data/actions.ts y de canMoveOccurrence
  if p_target is null or p_date is null then
    raise exception 'target-required' using errcode = 'P0001';
  end if;
  if not public._occurs_on(p_task_id, p_date) then
    raise exception 'not-an-occurrence' using errcode = 'P0001';
  end if;
  -- ventana de marcar de la ocurrencia que se mueve (0005)
  v_eff := public._effective_date(p_task_id, p_date);
  if not public._window_open(v_family, v_eff) then
    raise exception 'locked' using errcode = 'P0001';
  end if;
  if p_target = v_eff then
    raise exception 'same-date' using errcode = 'P0001';
  end if;
  -- el destino también: a un día cuya ventana cerró no se mueve
  if not public._window_open(v_family, p_target) then
    raise exception 'past-target' using errcode = 'P0001';
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

-- ---------------------------------------------------------------------------
-- rpc_delete_occurrence
-- ---------------------------------------------------------------------------

create or replace function public.rpc_delete_occurrence(p_task_id uuid, p_date date, p_actor uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  t public.task := public._live_task(p_task_id, v_family);
begin
  if p_date is null or not public._occurs_on(p_task_id, p_date) then
    raise exception 'not-an-occurrence' using errcode = 'P0001';
  end if;
  if not public._window_open(v_family, public._effective_date(p_task_id, p_date)) then
    raise exception 'locked' using errcode = 'P0001';
  end if;
  insert into public.occurrence_override (task_id, occurrence_date, family_id, deleted, deleted_at, deleted_by_id)
  values (p_task_id, p_date, v_family, true, now(), p_actor)
  on conflict (task_id, occurrence_date) do update
    set deleted = true, deleted_at = excluded.deleted_at, deleted_by_id = excluded.deleted_by_id;
  perform public._log_event(v_family, p_actor, 'deleted_occurrence', p_task_id, p_date, p_device, '{}');
end;
$$;

-- ---------------------------------------------------------------------------
-- rpc_update_task
-- ---------------------------------------------------------------------------

drop function public.rpc_update_task(uuid, jsonb, uuid, text);

create function public.rpc_update_task(p_task_id uuid, p_patch jsonb, p_actor uuid, p_device text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  o public.task := public._live_task(p_task_id, v_family);
  n public.task;
  c public.task;
  v_assignee uuid;
  v_today date;
  v_touch_assignee boolean;
  v_touch_rule boolean;
  v_new uuid;
begin
  if p_patch ? 'assignee_id' then
    v_assignee := (p_patch ->> 'assignee_id')::uuid;
    if not exists (
      select 1 from public.member where id = v_assignee and family_id = v_family and active
    ) then
      raise exception 'assignee-not-in-family' using errcode = '42501';
    end if;
  end if;

  select (now() at time zone f.time_zone)::date into v_today from public.family f where f.id = v_family;

  -- La recurrencia propuesta (completa cuando el parche trae `rule`; si no, la de hoy).
  c := o;
  if p_patch ? 'rule' then
    c.rule := p_patch ->> 'rule';
    c.due_date := (p_patch ->> 'due_date')::date;
    c.weekdays := public._jsonb_smallints(p_patch -> 'weekdays');
    c.month_day := (p_patch ->> 'month_day')::smallint;
    c.start_date := (p_patch ->> 'start_date')::date;
    c.end_date := (p_patch ->> 'end_date')::date;
  end if;
  v_touch_assignee := p_patch ? 'assignee_id' and v_assignee is distinct from o.assignee_id;
  v_touch_rule := (c.rule, c.due_date, c.weekdays, c.month_day, c.start_date, c.end_date)
                  is distinct from (o.rule, o.due_date, o.weekdays, o.month_day, o.start_date, o.end_date);

  -- Una tarea de un día cuya ventana ya cerró no se reasigna ni se convierte.
  if o.rule = 'once' and (v_touch_assignee or v_touch_rule)
     and not public._window_open(v_family, public._effective_date(o.id, o.due_date)) then
    raise exception 'locked' using errcode = 'P0001';
  end if;

  if o.rule <> 'once' and (v_touch_assignee or v_touch_rule) and exists (
       select 1
         from generate_series(o.start_date, least(coalesce(o.end_date, v_today - 1), v_today - 1),
                              interval '1 day') d
        where public._scheduled_on(o, d::date)
     ) then
    -- ---- Partir la serie: el pasado queda en la tarea vieja, el cambio vale desde hoy ----

    -- Nombre y «De la casa» se aplican a la tarea vieja como siempre (no reescriben cumplimiento).
    update public.task t set
      title = case when p_patch ? 'title' then p_patch ->> 'title' else t.title end,
      is_household = case when p_patch ? 'is_household'
                          then (p_patch ->> 'is_household')::boolean else t.is_household end
    where t.id = o.id
    returning * into n;
    if n.title is distinct from o.title then
      perform public._log_event(v_family, p_actor, 'renamed', o.id, null, p_device,
        jsonb_build_object('from', o.title, 'to', n.title));
    end if;
    if n.is_household is distinct from o.is_household then
      perform public._log_event(v_family, p_actor, 'assigned', o.id, null, p_device,
        jsonb_build_object('from', o.assignee_id, 'to', o.assignee_id,
          'household_from', o.is_household, 'household_to', n.is_household));
    end if;

    -- La copia: misma recurrencia (o la nueva) pero nunca antes de hoy.
    if c.rule = 'once' then
      if not public._window_open(v_family, c.due_date) then
        raise exception 'locked' using errcode = 'P0001';
      end if;
    else
      c.start_date := greatest(c.start_date, v_today);
      if c.end_date is not null and c.end_date < c.start_date then
        raise exception 'locked' using errcode = 'P0001';
      end if;
    end if;

    insert into public.task (
      family_id, title, assignee_id, created_by_id, created_at, is_household,
      rule, due_date, weekdays, month_day, start_date, end_date
    ) values (
      v_family, n.title, coalesce(case when v_touch_assignee then v_assignee end, o.assignee_id),
      o.created_by_id, o.created_at, n.is_household,
      c.rule, c.due_date, c.weekdays, c.month_day, c.start_date, c.end_date
    ) returning id into v_new;

    -- La serie vieja termina ayer.
    update public.task set end_date = least(coalesce(end_date, v_today - 1), v_today - 1)
     where id = o.id
     returning * into n;

    -- Lo de hoy en adelante (movidas, borradas, excusas y marcas) sigue a la serie nueva.
    update public.occurrence_override set task_id = v_new
     where task_id = o.id and occurrence_date >= v_today;
    update public.completion set task_id = v_new
     where task_id = o.id and occurrence_date >= v_today;

    perform public._log_event(v_family, p_actor, 'recurrence_changed', o.id, null, p_device,
      jsonb_build_object(
        'from', jsonb_build_object('rule', o.rule, 'due_date', o.due_date, 'weekdays', o.weekdays,
          'month_day', o.month_day, 'start_date', o.start_date, 'end_date', o.end_date),
        'to', jsonb_build_object('rule', n.rule, 'due_date', n.due_date, 'weekdays', n.weekdays,
          'month_day', n.month_day, 'start_date', n.start_date, 'end_date', n.end_date),
        'split_to', v_new));
    if v_touch_assignee then
      perform public._log_event(v_family, p_actor, 'assigned', v_new, null, p_device,
        jsonb_build_object(
          'from', o.assignee_id, 'to', v_assignee,
          'household_from', n.is_household, 'household_to', n.is_household,
          'split_from', o.id));
    end if;
    if v_touch_rule then
      perform public._log_event(v_family, p_actor, 'recurrence_changed', v_new, null, p_device,
        jsonb_build_object(
          'from', jsonb_build_object('rule', o.rule, 'due_date', o.due_date, 'weekdays', o.weekdays,
            'month_day', o.month_day, 'start_date', o.start_date, 'end_date', o.end_date),
          'to', jsonb_build_object('rule', c.rule, 'due_date', c.due_date, 'weekdays', c.weekdays,
            'month_day', c.month_day, 'start_date', c.start_date, 'end_date', c.end_date),
          'split_from', o.id));
    end if;
    return v_new;
  end if;

  -- ---- Sin pasado que proteger: se edita en sitio, como en 0001 ----
  update public.task t set
    title = case when p_patch ? 'title' then p_patch ->> 'title' else t.title end,
    assignee_id = case when p_patch ? 'assignee_id' then v_assignee else t.assignee_id end,
    is_household = case when p_patch ? 'is_household'
                        then (p_patch ->> 'is_household')::boolean else t.is_household end,
    rule = c.rule,
    due_date = c.due_date,
    weekdays = c.weekdays,
    month_day = c.month_day,
    start_date = c.start_date,
    end_date = c.end_date
  where t.id = p_task_id
  returning * into n;

  if n.title is distinct from o.title then
    perform public._log_event(v_family, p_actor, 'renamed', p_task_id, null, p_device,
      jsonb_build_object('from', o.title, 'to', n.title));
  end if;
  if n.assignee_id is distinct from o.assignee_id or n.is_household is distinct from o.is_household then
    perform public._log_event(v_family, p_actor, 'assigned', p_task_id, null, p_device,
      jsonb_build_object(
        'from', o.assignee_id, 'to', n.assignee_id,
        'household_from', o.is_household, 'household_to', n.is_household));
  end if;
  if (n.rule, n.due_date, n.weekdays, n.month_day, n.start_date, n.end_date)
     is distinct from (o.rule, o.due_date, o.weekdays, o.month_day, o.start_date, o.end_date) then
    perform public._log_event(v_family, p_actor, 'recurrence_changed', p_task_id, null, p_device,
      jsonb_build_object(
        'from', jsonb_build_object('rule', o.rule, 'due_date', o.due_date, 'weekdays', o.weekdays,
          'month_day', o.month_day, 'start_date', o.start_date, 'end_date', o.end_date),
        'to', jsonb_build_object('rule', n.rule, 'due_date', n.due_date, 'weekdays', n.weekdays,
          'month_day', n.month_day, 'start_date', n.start_date, 'end_date', n.end_date)));
  end if;
  return p_task_id;
end;
$$;

revoke all on function public.rpc_update_task(uuid, jsonb, uuid, text) from public, anon;
grant execute on function public.rpc_update_task(uuid, jsonb, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.family;
