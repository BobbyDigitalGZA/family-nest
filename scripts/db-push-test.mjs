// Empuja las migraciones (y la semilla inventada) al proyecto de PRUEBAS.
// Lee .env.test.local; la URL de conexión se arma en memoria y nunca se imprime ni se guarda.
// Uso: node scripts/db-push-test.mjs
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'

process.loadEnvFile('.env.test.local')
const ref = new URL(process.env.VITE_SUPABASE_URL ?? '').hostname.split('.')[0]
const password = process.env.SUPABASE_DB_PASSWORD
if (!ref || !password) throw new Error('Faltan VITE_SUPABASE_URL o SUPABASE_DB_PASSWORD en .env.test.local')
if (ref === 'oeipucoenyhhrmyermdv') throw new Error('Este script es solo para el proyecto de pruebas')

const dbUrl = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-1-us-west-2.pooler.supabase.com:5432/postgres`
// npx-cli.js directo y sin shell: la contraseña codificada lleva '%', que cmd.exe expandiría.
const npxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')
const res = spawnSync(
  process.execPath,
  [npxCli, 'supabase', 'db', 'push', '--db-url', dbUrl, '--include-seed', ...process.argv.slice(2)],
  { stdio: ['inherit', 'pipe', 'pipe'], encoding: 'utf8' },
)
// Por si la CLI repitiera la URL en un error, se tapa antes de mostrar nada.
const scrub = (s) => s.split(dbUrl).join('<db-url>').split(encodeURIComponent(password)).join('<pw>')
process.stdout.write(scrub(res.stdout ?? ''))
process.stderr.write(scrub(res.stderr ?? ''))
process.exit(res.status ?? 1)
