-- SOLO para el proyecto de pruebas (`supabase db push --include-seed`).
-- Familia inventada: ningún dato real. En el proyecto real NUNCA se usa --include-seed:
-- esta familia bloquearía create_family.

insert into public.family (id, name, time_zone, join_code)
values ('00000000-0000-4000-8000-000000000001', 'Familia de prueba', 'UTC', 'SEEDTEST');

insert into public.member (id, family_id, nickname, color, sort_order) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'Ana',  'blue',  0),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 'Leo',  'pink',  1),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', 'Sol',  'lilac', 2),
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-000000000001', 'Tomi', 'green', 3);

-- Una tarea de cada tipo: de un día, semanal (lunes y jueves) y mensual (día 31: cae en el último día del mes).
insert into public.task
  (id, family_id, title, assignee_id, created_by_id, is_household, rule, due_date, weekdays, month_day, start_date)
values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001',
   'Regar las plantas', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1',
   false, 'once', current_date, null, null, null),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001',
   'Sacar la basura', '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a1',
   true, 'weekly', null, array[1, 4]::smallint[], null, current_date),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-000000000001',
   'Revisar los gastos', '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a2',
   false, 'monthly', null, null, 31, current_date);
