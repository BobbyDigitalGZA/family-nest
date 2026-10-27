# Seguridad

## Cómo reportar un fallo

No abras un issue público. Usa el reporte privado de GitHub: pestaña **Security → Report a vulnerability** de este repositorio (*private vulnerability reporting / security advisories*). Incluye los pasos para reproducirlo y qué datos quedarían expuestos. Responderemos lo antes posible.

## Qué nunca se sube al repositorio

- Archivos `.env` y `.env.*` (solo se versiona `.env.example`, sin valores reales).
- `supabase/seed.local.sql` (semillas con datos reales de una familia).
- `.private-names.local` (lista privada de nombres para `npm run check:private`).
- Cualquier dato de una familia real: nombres, apodos, edades, cumpleaños, ciudad, fotos.

Antes de cada push corre `npm run check:private`.

## Claves

- La app solo usa `VITE_SUPABASE_URL` y la clave **publishable**. Son públicas por diseño; la seguridad la dan las políticas RLS de `supabase/migrations/`.
- La clave `secret` / `service_role` **nunca** va al cliente, a Vercel ni a un archivo del repositorio. Si se filtró, rótala en Supabase de inmediato.
- Si una clave llegó a un commit, rótala aunque borres el commit: el historial público ya la expuso.
