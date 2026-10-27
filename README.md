# Family Nest

A shared home for a family's tasks, calendar and weekly progress. It runs as an installable web app (PWA) on a wall touchscreen and on everyone's phones.

> **Status: early development.** Nothing is usable yet. The first phase builds the base app: members, tasks, recurring chores, completion and an event log.

## What it will do

- One tab per family member, for any number of members.
- Tasks with a checkbox, weekly and monthly repeats, and moving a single occurrence to another day.
- Daily and weekly completion, always shown with the task count ("50 % · 1 of 2").
- Weekly levels, from Bronze to Diamond, for everyone who completes their week.
- A morning greeting with the weather and calendar. The hub only speaks when someone activates it.
- Spanish first, translatable.

## How a family will install it

Each family runs its own copy. Their data lives in their own free [Supabase](https://supabase.com) project, and none of it ever goes into this repository. Setup guide (Spanish): [docs/INSTALL.md](docs/INSTALL.md). Security: [SECURITY.md](SECURITY.md).

## Desarrollo

- `npm run dev` usa `.env.local` (el proyecto real).
- Para el proyecto de pruebas: `npx vite --mode test` (usa `.env.test.local`) y `node scripts/db-push-test.mjs` para empujar migraciones y la semilla inventada.
- Revisión de permisos (RLS): `npx tsx scripts/rls-check.ts`.
- Pruebas y chequeos: `npx vitest run`, `npx tsc -b`, `npm run lint`, `npm run check:private`.
- Íconos de la PWA: edita `public/icons/source.svg` y corre `npm run icons`.

---

**Español:** Family Nest es un hub familiar de tareas, calendario y progreso semanal, para una pantalla de pared y los celulares de la familia. Está en desarrollo temprano.

## License

[MIT](LICENSE)
