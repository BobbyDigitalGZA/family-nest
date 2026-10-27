-- Family Nest: esquema núcleo, RLS y RPC.
-- Regla central: los clientes (anon / authenticated) solo LEEN las tablas; toda escritura
-- pasa por funciones RPC `security definer` que escriben el dato y su fila de event_log en
-- la misma transacción. Las excepciones: member y family (update de columnas de
-- configuración) e interaction (insert).

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.family (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  time_zone text not null,
  join_code text unique,
  created_at timestamptz not null default now()
);

create table public.member (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.family (id) on delete cascade,
  nickname text not null check (length(nickname) between 1 and 24),
  color text not null,
  birthday date null,
  sort_order int not null default 0,
  auth_user_id uuid unique null references auth.users (id) on delete set null,
  active boolean not null default true
);
create index member_family_idx on public.member (family_id);

create table public.wall_device (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references public.family (id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);
create index wall_device_family_idx on public.wall_device (family_id);

create table public.task (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.family (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  assignee_id uuid not null references public.member (id),
  created_by_id uuid not null references public.member (id),
  created_at timestamptz not null default now(),
  is_household boolean not null default false,
  rule text not null check (rule in ('once', 'weekly', 'monthly')),
  due_date date null,
  weekdays smallint[] null,
  month_day smallint null check (month_day between 1 and 31),
  start_date date null,
  end_date date null,
  deleted_at timestamptz null,
  deleted_by_id uuid null references public.member (id),
  constraint task_rule_fields check (
    (rule = 'once'
      and due_date is not null and weekdays is null and month_day is null
      and start_date is null and end_date is null)
    or (rule = 'weekly'
      and weekdays is not null and cardinality(weekdays) > 0
      and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
      and due_date is null and month_day is null and start_date is not null)
    or (rule = 'monthly'
      and month_day is not null and due_date is null and weekdays is null
      and start_date is not null)
  ),
  constraint task_end_after_start check (
    end_date is null or start_date is null or end_date >= start_date
  )
);
create index task_family_idx on public.task (family_id);

create table public.occurrence_override (
  task_id uuid not null references public.task (id) on delete cascade,
  occurrence_date date not null,
  family_id uuid not null references public.family (id) on delete cascade,
  moved_to date null,
  moved_at timestamptz null,
  moved_by_id uuid null references public.member (id),
  deleted boolean not null default false,
  deleted_at timestamptz null,
  deleted_by_id uuid null references public.member (id),
  excused_by_id uuid null references public.member (id),
  excused_at timestamptz null,
  primary key (task_id, occurrence_date)
);
create index occurrence_override_family_idx on public.occurrence_override (family_id);

create table public.completion (
  task_id uuid not null references public.task (id) on delete cascade,
  occurrence_date date not null,
  family_id uuid not null references public.family (id) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_by_id uuid not null references public.member (id),
  late boolean not null default false,
  primary key (task_id, occurrence_date)
);
create index completion_family_idx on public.completion (family_id);

create table public.event_log (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.family (id) on delete cascade,
  at timestamptz not null default now(),
  actor_id uuid not null references public.member (id),
  type text not null,
  task_id uuid null references public.task (id),
  occurrence_date date null,
  device text check (device in ('wall', 'phone')),
  payload jsonb not null default '{}'::jsonb
);
create index event_log_family_idx on public.event_log (family_id, id);
create index event_log_task_idx on public.event_log (task_id);

create table public.interaction (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.family (id) on delete cascade,
  member_id uuid not null references public.member (id),
  at timestamptz not null default now(),
  device text check (device in ('wall', 'phone')),
  kind text not null check (kind in ('open', 'action'))
);
create index interaction_family_idx on public.interaction (family_id);

create function public._check_time_zone() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'invalid-time-zone' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger family_time_zone before insert or update of time_zone on public.family
  for each row execute function public._check_time_zone();

-- ---------------------------------------------------------------------------
-- Identidad de la sesión
-- ---------------------------------------------------------------------------

create function public.current_family_id() returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.member where auth_user_id = auth.uid() and active
  union all
  select family_id from public.wall_device where auth_user_id = auth.uid()
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- RLS: lectura de la propia familia; sin escritura directa salvo lo listado
-- ---------------------------------------------------------------------------

alter table public.family enable row level security;
alter table public.member enable row level security;
alter table public.wall_device enable row level security;
alter table public.task enable row level security;
alter table public.occurrence_override enable row level security;
alter table public.completion enable row level security;
alter table public.event_log enable row level security;
alter table public.interaction enable row level security;

create policy family_select on public.family for select to authenticated
  using (id = public.current_family_id());
create policy family_update on public.family for update to authenticated
  using (id = public.current_family_id())
  with check (id = public.current_family_id());

create policy member_select on public.member for select to authenticated
  using (family_id = public.current_family_id());
create policy member_update on public.member for update to authenticated
  using (family_id = public.current_family_id())
  with check (family_id = public.current_family_id());

create policy wall_device_select on public.wall_device for select to authenticated
  using (family_id = public.current_family_id());
create policy task_select on public.task for select to authenticated
  using (family_id = public.current_family_id());
create policy occurrence_override_select on public.occurrence_override for select to authenticated
  using (family_id = public.current_family_id());
create policy completion_select on public.completion for select to authenticated
  using (family_id = public.current_family_id());
create policy event_log_select on public.event_log for select to authenticated
  using (family_id = public.current_family_id());

create policy interaction_select on public.interaction for select to authenticated
  using (family_id = public.current_family_id());
create policy interaction_insert on public.interaction for insert to authenticated
  with check (
    family_id = public.current_family_id()
    and exists (
      select 1 from public.member m
      where m.id = member_id and m.family_id = interaction.family_id
    )
  );

-- Privilegios de tabla: Supabase da ALL a anon y authenticated por defecto; se quitan.
revoke all on public.family, public.member, public.wall_device, public.task,
  public.occurrence_override, public.completion, public.event_log, public.interaction
  from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.family, public.member, public.wall_device, public.task,
  public.occurrence_override, public.completion, public.event_log, public.interaction
  to authenticated;
grant insert on public.interaction to authenticated;
-- Update solo de columnas de configuración (nunca id, family_id, auth_user_id ni join_code).
-- La Tarea 7 amplía el grant de family con sus columnas de configuración.
grant update (nickname, color, birthday, sort_order, active) on public.member to authenticated;
grant update (name, time_zone) on public.family to authenticated;

-- ---------------------------------------------------------------------------
-- Ayudantes internos (no expuestos a los clientes)
-- ---------------------------------------------------------------------------

create function public._new_join_code() returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 símbolos, sin O/0/I/1
  bytes bytea;
  code text;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    code := '';
    for i in 0..7 loop
      code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.family where join_code = code);
  end loop;
  return code;
end;
$$;

create function public._jsonb_smallints(j jsonb) returns smallint[]
language sql
immutable
as $$
  select case
    when j is null or jsonb_typeof(j) <> 'array' then null
    else array(select value::smallint from jsonb_array_elements_text(j))
  end
$$;

-- Familia del llamador, comprobando que el actor sea un miembro activo de ella.
create function public._actor_family(p_actor uuid) returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_family uuid := public.current_family_id();
begin
  if v_family is null then
    raise exception 'not-a-member' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.member where id = p_actor and family_id = v_family and active
  ) then
    raise exception 'actor-not-in-family' using errcode = '42501';
  end if;
  return v_family;
end;
$$;

-- Tarea de la familia (bloqueada contra cambios concurrentes); exige que no esté borrada.
create function public._live_task(p_task_id uuid, p_family uuid) returns public.task
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.task;
begin
  select * into t from public.task
   where id = p_task_id and family_id = p_family for update;
  if not found then
    raise exception 'task-not-found' using errcode = 'P0002';
  end if;
  if t.deleted_at is not null then
    raise exception 'task-deleted' using errcode = 'P0001';
  end if;
  return t;
end;
$$;

-- ¿La regla de la tarea la programa ese día? (espejo de isScheduledOn en src/domain/recurrence.ts)
create function public._scheduled_on(t public.task, d date) returns boolean
language sql
immutable
as $$
  select case t.rule
    when 'once' then t.due_date = d
    when 'weekly' then d >= t.start_date and (t.end_date is null or d <= t.end_date)
      and extract(isodow from d)::smallint = any (t.weekdays)
    when 'monthly' then d >= t.start_date and (t.end_date is null or d <= t.end_date)
      and extract(day from d)::int = least(
        t.month_day,
        extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int)
    else false
  end
$$;

-- Ocurrencia viva identificada por su fecha original: programada y no borrada.
create function public._occurs_on(p_task_id uuid, p_original date) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select public._scheduled_on(t, p_original)
       and not coalesce((select o.deleted from public.occurrence_override o
                          where o.task_id = t.id and o.occurrence_date = p_original), false)
      from public.task t
     where t.id = p_task_id and t.deleted_at is null
  ), false)
$$;

-- ¿Cae alguna ocurrencia de la tarea EN ese día (por regla o movida hasta él)?
create function public._has_occurrence_on(p_task_id uuid, p_day date) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from (select p_day as orig
            union
            select o.occurrence_date from public.occurrence_override o
             where o.task_id = p_task_id and o.moved_to = p_day) c
     where public._occurs_on(p_task_id, c.orig)
       and coalesce((select o.moved_to from public.occurrence_override o
                      where o.task_id = p_task_id and o.occurrence_date = c.orig), c.orig) = p_day
  )
$$;

create function public._log_event(
  p_family uuid, p_actor uuid, p_type text, p_task uuid, p_date date, p_device text, p_payload jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.event_log (family_id, actor_id, type, task_id, occurrence_date, device, payload)
  values (p_family, p_actor, p_type, p_task, p_date, p_device, coalesce(p_payload, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- RPC de alta de familia, reclamo de miembro y equipo de pared
-- ---------------------------------------------------------------------------

create function public.create_family(p_name text, p_time_zone text, p_members jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_family uuid;
  v_code text;
  v_first uuid;
  v_id uuid;
  m jsonb;
  i int := 0;
begin
  if v_uid is null then
    raise exception 'not-authenticated' using errcode = '42501';
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
  insert into public.family (name, time_zone, join_code)
  values (p_name, p_time_zone, v_code)
  returning id into v_family;

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
    if i = 0 then v_first := v_id; end if;
    i := i + 1;
  end loop;

  return v_code;
end;
$$;

create function public.claim_member(p_member uuid, p_code text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not-authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.member where auth_user_id = v_uid)
     or exists (select 1 from public.wall_device where auth_user_id = v_uid) then
    raise exception 'already-linked';
  end if;
  update public.member m
     set auth_user_id = v_uid
    from public.family f
   where m.id = p_member
     and f.id = m.family_id
     and f.join_code = upper(btrim(p_code))
     and m.auth_user_id is null
     and m.active;
  if not found then
    raise exception 'invalid-claim' using errcode = '42501'; -- mismo error para código malo o miembro ya reclamado
  end if;
end;
$$;

create function public.register_wall_device(p_code text, p_label text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_family uuid;
begin
  if v_uid is null then
    raise exception 'not-authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.member where auth_user_id = v_uid)
     or exists (select 1 from public.wall_device where auth_user_id = v_uid) then
    raise exception 'already-linked';
  end if;
  select id into v_family from public.family where join_code = upper(btrim(p_code));
  if v_family is null then
    raise exception 'invalid-code' using errcode = '42501';
  end if;
  insert into public.wall_device (auth_user_id, family_id, label)
  values (v_uid, v_family, p_label);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC de escritura: dato + event_log en la misma transacción
-- p_actor = miembro que actúa (de la familia del llamador); p_device = 'wall' | 'phone'
-- (no se valida aquí: el check de event_log lo rechaza y revierte todo).
-- ---------------------------------------------------------------------------

create function public.rpc_create_task(p_task jsonb, p_actor uuid, p_device text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  v_assignee uuid := (p_task ->> 'assignee_id')::uuid;
  v_id uuid;
begin
  if not exists (
    select 1 from public.member where id = v_assignee and family_id = v_family and active
  ) then
    raise exception 'assignee-not-in-family' using errcode = '42501';
  end if;
  insert into public.task (
    family_id, title, assignee_id, created_by_id, is_household,
    rule, due_date, weekdays, month_day, start_date, end_date
  ) values (
    v_family,
    p_task ->> 'title',
    v_assignee,
    p_actor,
    coalesce((p_task ->> 'is_household')::boolean, false),
    p_task ->> 'rule',
    (p_task ->> 'due_date')::date,
    public._jsonb_smallints(p_task -> 'weekdays'),
    (p_task ->> 'month_day')::smallint,
    (p_task ->> 'start_date')::date,
    (p_task ->> 'end_date')::date
  ) returning id into v_id;
  perform public._log_event(
    v_family, p_actor, 'created', v_id, null, p_device,
    jsonb_build_object('assignee_id', v_assignee)
  );
  return v_id;
end;
$$;

create function public.rpc_update_task(p_task_id uuid, p_patch jsonb, p_actor uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  o public.task := public._live_task(p_task_id, v_family);
  n public.task;
  v_assignee uuid;
begin
  if p_patch ? 'assignee_id' then
    v_assignee := (p_patch ->> 'assignee_id')::uuid;
    if not exists (
      select 1 from public.member where id = v_assignee and family_id = v_family and active
    ) then
      raise exception 'assignee-not-in-family' using errcode = '42501';
    end if;
  end if;

  update public.task t set
    title = case when p_patch ? 'title' then p_patch ->> 'title' else t.title end,
    assignee_id = case when p_patch ? 'assignee_id' then v_assignee else t.assignee_id end,
    is_household = case when p_patch ? 'is_household'
                        then (p_patch ->> 'is_household')::boolean else t.is_household end,
    -- La recurrencia se reemplaza completa cuando el parche trae `rule`.
    rule = case when p_patch ? 'rule' then p_patch ->> 'rule' else t.rule end,
    due_date = case when p_patch ? 'rule' then (p_patch ->> 'due_date')::date else t.due_date end,
    weekdays = case when p_patch ? 'rule'
                    then public._jsonb_smallints(p_patch -> 'weekdays') else t.weekdays end,
    month_day = case when p_patch ? 'rule'
                     then (p_patch ->> 'month_day')::smallint else t.month_day end,
    start_date = case when p_patch ? 'rule'
                      then (p_patch ->> 'start_date')::date else t.start_date end,
    end_date = case when p_patch ? 'rule' then (p_patch ->> 'end_date')::date else t.end_date end
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
end;
$$;

create function public.rpc_complete(
  p_task_id uuid, p_date date, p_late boolean, p_for_other boolean, p_actor uuid, p_device text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  t public.task := public._live_task(p_task_id, v_family);
  v_rows int;
  v_tz text;
  v_now timestamp;
  v_late boolean;
begin
  -- p_late se ignora: el servidor decide (espejo de canMarkDone). 10:00 fijo hasta que
  -- la Tarea 7 agregue family.late_mark_until.
  select time_zone into v_tz from public.family where id = v_family;
  v_now := now() at time zone v_tz;
  if p_date is null or not public._occurs_on(p_task_id, p_date) then
    raise exception 'not-an-occurrence' using errcode = 'P0001';
  end if;
  if p_date >= v_now::date then
    v_late := false;
  elsif p_date = v_now::date - 1 and v_now::time < time '10:00' then
    v_late := true;
  else
    raise exception 'locked' using errcode = 'P0001';
  end if;
  insert into public.completion (task_id, occurrence_date, family_id, completed_by_id, late)
  values (p_task_id, p_date, v_family, p_actor, v_late)
  on conflict (task_id, occurrence_date) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    perform public._log_event(v_family, p_actor, 'completed', p_task_id, p_date, p_device,
      jsonb_build_object('late', v_late, 'forOther', coalesce(p_for_other, false)));
  end if;
end;
$$;

create function public.rpc_uncomplete(p_task_id uuid, p_date date, p_actor uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  t public.task := public._live_task(p_task_id, v_family);
  v_rows int;
begin
  delete from public.completion
   where task_id = p_task_id and occurrence_date = p_date and family_id = v_family;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then
    perform public._log_event(v_family, p_actor, 'uncompleted', p_task_id, p_date, p_device, '{}');
  end if;
end;
$$;

create function public.rpc_move(p_task_id uuid, p_date date, p_target date, p_actor uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  t public.task := public._live_task(p_task_id, v_family);
begin
  -- espejo de canMoveOccurrence
  if p_target is null or p_date is null then
    raise exception 'target-required' using errcode = 'P0001';
  end if;
  if not public._occurs_on(p_task_id, p_date) then
    raise exception 'not-an-occurrence' using errcode = 'P0001';
  end if;
  if p_target = coalesce((select o.moved_to from public.occurrence_override o
                           where o.task_id = p_task_id and o.occurrence_date = p_date), p_date) then
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

create function public.rpc_delete_occurrence(p_task_id uuid, p_date date, p_actor uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  t public.task := public._live_task(p_task_id, v_family);
begin
  insert into public.occurrence_override (task_id, occurrence_date, family_id, deleted, deleted_at, deleted_by_id)
  values (p_task_id, p_date, v_family, true, now(), p_actor)
  on conflict (task_id, occurrence_date) do update
    set deleted = true, deleted_at = excluded.deleted_at, deleted_by_id = excluded.deleted_by_id;
  perform public._log_event(v_family, p_actor, 'deleted_occurrence', p_task_id, p_date, p_device, '{}');
end;
$$;

create function public.rpc_excuse(p_task_id uuid, p_date date, p_actor uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  t public.task := public._live_task(p_task_id, v_family);
begin
  insert into public.occurrence_override (task_id, occurrence_date, family_id, excused_by_id, excused_at)
  values (p_task_id, p_date, v_family, p_actor, now())
  on conflict (task_id, occurrence_date) do update
    set excused_by_id = excluded.excused_by_id, excused_at = excluded.excused_at;
  perform public._log_event(v_family, p_actor, 'excused', p_task_id, p_date, p_device, '{}');
end;
$$;

-- p_new_rule null = borrar la tarea (borrado suave); si no, reemplaza la recurrencia.
create function public.rpc_end_series(p_task_id uuid, p_new_rule jsonb, p_actor uuid, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid := public._actor_family(p_actor);
  o public.task := public._live_task(p_task_id, v_family);
begin
  if p_new_rule is null or p_new_rule = 'null'::jsonb then
    update public.task set deleted_at = now(), deleted_by_id = p_actor where id = p_task_id;
    perform public._log_event(v_family, p_actor, 'deleted_series', p_task_id, null, p_device,
      jsonb_build_object('deleted_task', true));
  else
    update public.task set
      rule = p_new_rule ->> 'rule',
      due_date = (p_new_rule ->> 'due_date')::date,
      weekdays = public._jsonb_smallints(p_new_rule -> 'weekdays'),
      month_day = (p_new_rule ->> 'month_day')::smallint,
      start_date = (p_new_rule ->> 'start_date')::date,
      end_date = (p_new_rule ->> 'end_date')::date
    where id = p_task_id;
    perform public._log_event(v_family, p_actor, 'deleted_series', p_task_id, null, p_device,
      jsonb_build_object('deleted_task', false, 'previous_end_date', o.end_date,
        'new_end_date', (p_new_rule ->> 'end_date')::date));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución: nada para anon; los ayudantes internos, para nadie.
-- ---------------------------------------------------------------------------

revoke all on function
  public._new_join_code(), public._jsonb_smallints(jsonb), public._actor_family(uuid),
  public._live_task(uuid, uuid), public._check_time_zone(),
  public._scheduled_on(public.task, date), public._occurs_on(uuid, date),
  public._has_occurrence_on(uuid, date),
  public._log_event(uuid, uuid, text, uuid, date, text, jsonb)
  from public, anon, authenticated;

revoke all on function
  public.current_family_id(),
  public.create_family(text, text, jsonb),
  public.claim_member(uuid, text),
  public.register_wall_device(text, text),
  public.rpc_create_task(jsonb, uuid, text),
  public.rpc_update_task(uuid, jsonb, uuid, text),
  public.rpc_complete(uuid, date, boolean, boolean, uuid, text),
  public.rpc_uncomplete(uuid, date, uuid, text),
  public.rpc_move(uuid, date, date, uuid, text),
  public.rpc_delete_occurrence(uuid, date, uuid, text),
  public.rpc_excuse(uuid, date, uuid, text),
  public.rpc_end_series(uuid, jsonb, uuid, text)
  from public, anon;

grant execute on function
  public.current_family_id(),
  public.create_family(text, text, jsonb),
  public.claim_member(uuid, text),
  public.register_wall_device(text, text),
  public.rpc_create_task(jsonb, uuid, text),
  public.rpc_update_task(uuid, jsonb, uuid, text),
  public.rpc_complete(uuid, date, boolean, boolean, uuid, text),
  public.rpc_uncomplete(uuid, date, uuid, text),
  public.rpc_move(uuid, date, date, uuid, text),
  public.rpc_delete_occurrence(uuid, date, uuid, text),
  public.rpc_excuse(uuid, date, uuid, text),
  public.rpc_end_series(uuid, jsonb, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.task, public.occurrence_override, public.completion, public.member;
