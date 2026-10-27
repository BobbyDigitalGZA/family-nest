-- Family Nest: tablas previstas para el saludo, los niveles y las celebraciones (Fase 2).
-- Sin pantallas en la Fase 1: solo existen para que la Fase 2 no migre datos.
-- Misma regla que el núcleo: los clientes solo LEEN (política por family_id); las escribe
-- la lógica de servidor (service role / RPC) de la Fase 2.

-- ---------------------------------------------------------------------------
-- Configuración de la familia
-- País, ciudad y coordenadas no tienen valor por defecto: los pide Setup.
-- ---------------------------------------------------------------------------

alter table public.family
  add column week_close_dow smallint not null default 7
    constraint family_week_close_dow check (week_close_dow between 1 and 7),
  add column week_close_time time not null default '21:00',
  add column weekly_min_tasks smallint not null default 5
    constraint family_weekly_min_tasks check (weekly_min_tasks > 0),
  add column season_weeks smallint not null default 12
    constraint family_season_weeks check (season_weeks > 0),
  add column idle_seconds int not null default 120
    constraint family_idle_seconds check (idle_seconds > 0),
  add column late_mark_until time not null default '10:00',
  add column country_code text null
    constraint family_country_code check (country_code is null or country_code ~ '^[A-Za-z]{2}$'),
  add column weather_city text null,
  add column weather_lat numeric null
    constraint family_weather_lat check (weather_lat is null or weather_lat between -90 and 90),
  add column weather_lon numeric null
    constraint family_weather_lon check (weather_lon is null or weather_lon between -180 and 180);

-- La familia edita su propia configuración (el grant de la Tarea 6 solo cubría name y time_zone).
grant update (
  week_close_dow, week_close_time, weekly_min_tasks, season_weeks, idle_seconds,
  late_mark_until, country_code, weather_city, weather_lat, weather_lon
) on public.family to authenticated;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Hora de salida al colegio de cada miembro que la tenga (para el saludo).
-- La apaga un evento "Vacaciones" del calendario familiar (Fase 2).
create table public.departure_rule (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.family (id) on delete cascade,
  member_id uuid not null references public.member (id) on delete cascade,
  leave_time time not null,
  weekdays smallint[] not null
    check (cardinality(weekdays) > 0 and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  start_date date not null,
  end_date date null,
  skip_holidays boolean not null default true,
  constraint departure_rule_end_after_start check (end_date is null or end_date >= start_date)
);
create index departure_rule_family_idx on public.departure_rule (family_id);
create index departure_rule_member_idx on public.departure_rule (member_id);

create table public.day_off (
  member_id uuid not null references public.member (id) on delete cascade,
  day date not null,
  family_id uuid not null references public.family (id) on delete cascade,
  reason text null,
  set_by_id uuid not null references public.member (id),
  created_at timestamptz not null default now(),
  primary key (member_id, day)
);
create index day_off_family_idx on public.day_off (family_id);

create table public.season (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.family (id) on delete cascade,
  number int not null,
  start_date date not null,
  end_date date not null,
  constraint season_end_after_start check (end_date >= start_date),
  unique (family_id, number)
);
create index season_family_idx on public.season (family_id);

create table public.season_medal (
  season_id uuid not null references public.season (id) on delete cascade,
  member_id uuid not null references public.member (id) on delete cascade,
  family_id uuid not null references public.family (id) on delete cascade,
  best_level smallint not null check (best_level between 1 and 8),
  primary key (season_id, member_id)
);
create index season_medal_family_idx on public.season_medal (family_id);

-- Niveles: 1 = Bronce ... 8 = Diamante.
create table public.level_state (
  member_id uuid primary key references public.member (id) on delete cascade,
  family_id uuid not null references public.family (id) on delete cascade,
  level smallint not null default 1 check (level between 1 and 8),
  diamond_stars int not null default 0 check (diamond_stars >= 0),
  season_id uuid null references public.season (id) on delete set null
);
create index level_state_family_idx on public.level_state (family_id);

create table public.week_close (
  member_id uuid not null references public.member (id) on delete cascade,
  week_start date not null,
  family_id uuid not null references public.family (id) on delete cascade,
  assigned int not null check (assigned >= 0),
  done int not null check (done >= 0),
  counts_for_minimum boolean not null,
  result text not null check (result in ('up', 'stay', 'short')),
  level_before smallint not null check (level_before between 1 and 8),
  level_after smallint not null check (level_after between 1 and 8),
  closed_at timestamptz not null default now(),
  primary key (member_id, week_start)
);
create index week_close_family_idx on public.week_close (family_id);

-- Una celebración por persona y por día (member_id null = de toda la familia).
create table public.celebration (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.family (id) on delete cascade,
  member_id uuid null references public.member (id) on delete cascade,
  kind text not null check (kind in ('daily', 'weekly')),
  for_date date not null,
  status text not null check (status in ('pending', 'shown', 'expired')),
  shown_at timestamptz null,
  shown_on text null,
  unique nulls not distinct (family_id, member_id, kind, for_date)
);
create index celebration_family_idx on public.celebration (family_id);

-- member_id null = la vista familiar.
create table public.greeting_memory (
  family_id uuid not null references public.family (id) on delete cascade,
  member_id uuid null references public.member (id) on delete cascade,
  day date not null,
  band text not null check (band in ('morning', 'afternoon', 'night')),
  said jsonb not null default '[]'::jsonb,
  last_spoken_at timestamptz null,
  unique nulls not distinct (family_id, member_id, day, band)
);
create index greeting_memory_family_idx on public.greeting_memory (family_id);

-- ---------------------------------------------------------------------------
-- RLS y privilegios: solo lectura de la propia familia
-- ---------------------------------------------------------------------------

alter table public.departure_rule enable row level security;
alter table public.day_off enable row level security;
alter table public.season enable row level security;
alter table public.season_medal enable row level security;
alter table public.level_state enable row level security;
alter table public.week_close enable row level security;
alter table public.celebration enable row level security;
alter table public.greeting_memory enable row level security;

create policy departure_rule_select on public.departure_rule for select to authenticated
  using (family_id = public.current_family_id());
create policy day_off_select on public.day_off for select to authenticated
  using (family_id = public.current_family_id());
create policy season_select on public.season for select to authenticated
  using (family_id = public.current_family_id());
create policy season_medal_select on public.season_medal for select to authenticated
  using (family_id = public.current_family_id());
create policy level_state_select on public.level_state for select to authenticated
  using (family_id = public.current_family_id());
create policy week_close_select on public.week_close for select to authenticated
  using (family_id = public.current_family_id());
create policy celebration_select on public.celebration for select to authenticated
  using (family_id = public.current_family_id());
create policy greeting_memory_select on public.greeting_memory for select to authenticated
  using (family_id = public.current_family_id());

revoke all on public.departure_rule, public.day_off, public.season, public.season_medal,
  public.level_state, public.week_close, public.celebration, public.greeting_memory
  from anon, authenticated;
grant select on public.departure_rule, public.day_off, public.season, public.season_medal,
  public.level_state, public.week_close, public.celebration, public.greeting_memory
  to authenticated;

-- ---------------------------------------------------------------------------
-- rpc_complete: el corte de "marcar tarde" sale de family.late_mark_until
-- (misma firma y mismos permisos que en 0001; solo cambia la constante 10:00).
-- ---------------------------------------------------------------------------

create or replace function public.rpc_complete(
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
  v_cutoff time;
  v_now timestamp;
  v_late boolean;
  v_eff date;
begin
  -- p_late se ignora: el servidor decide (espejo de canMarkDone).
  select time_zone, late_mark_until into v_tz, v_cutoff from public.family where id = v_family;
  v_now := now() at time zone v_tz;
  if p_date is null or not public._occurs_on(p_task_id, p_date) then
    raise exception 'not-an-occurrence' using errcode = 'P0001';
  end if;
  -- El corte se juzga por el día efectivo (moved_to si la ocurrencia se movió); la clave sigue siendo p_date.
  select coalesce(o.moved_to, p_date) into v_eff
    from (select 1) x
    left join public.occurrence_override o
      on o.task_id = p_task_id and o.occurrence_date = p_date;
  if v_eff >= v_now::date then
    v_late := false;
  elsif v_eff = v_now::date - 1 and v_now::time < v_cutoff then
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
