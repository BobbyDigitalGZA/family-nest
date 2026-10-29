// Empuja las migraciones (y la semilla inventada) al proyecto de PRUEBAS.
// Lee .env.test.local; la URL de conexión se arma en memoria y nunca se imprime ni se guarda.
// Lista permitida: el ref de VITE_SUPABASE_URL debe ser igual a SUPABASE_TEST_REF (del mismo
// archivo); si no, no se toca nada. El host del pooler sale de SUPABASE_POOLER_HOST (opcional).
// Uso: node scripts/db-push-test.mjs [reset | reset-noseed]
//   reset: recrea la base de PRUEBAS y vuelve a sembrar; reset-noseed: la recrea vacía (para probar la primera configuración).
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'

process.loadEnvFile('.env.test.local')
const ref = new URL(process.env.VITE_SUPABASE_URL ?? '').hostname.split('.')[0]
const password = process.env.SUPABASE_DB_PASSWORD
const testRef = process.env.SUPABASE_TEST_REF
if (!ref || !password) throw new Error('Faltan VITE_SUPABASE_URL o SUPABASE_DB_PASSWORD en .env.test.local')
if (!testRef) throw new Error('Falta SUPABASE_TEST_REF en .env.test.local (el ref del proyecto de pruebas)')
if (ref !== testRef) throw new Error('VITE_SUPABASE_URL no es el proyecto de pruebas (SUPABASE_TEST_REF): no se toca nada')
// Valor por defecto: el pooler de la región de los proyectos actuales.
const poolerHost = process.env.SUPABASE_POOLER_HOST || 'aws-1-us-west-2.pooler.supabase.com'

const dbUrl = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${poolerHost}:5432/postgres`
// npx-cli.js directo y sin shell: la contraseña codificada lleva '%', que cmd.exe expandiría.
const npxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')
const res = spawnSync(
  process.execPath,
  process.argv[2] === 'reset' || process.argv[2] === 'reset-noseed'
    ? [
        npxCli, 'supabase', 'db', 'reset', '--db-url', dbUrl, '--yes',
        ...(process.argv[2] === 'reset-noseed' ? ['--no-seed'] : []),
      ]
    : [npxCli, 'supabase', 'db', 'push', '--db-url', dbUrl, '--include-seed', ...process.argv.slice(2)],
  { stdio: ['inherit', 'pipe', 'pipe'], encoding: 'utf8' },
)
// Por si la CLI repitiera la URL en un error, se tapa antes de mostrar nada.
const scrub = (s) => s.split(dbUrl).join('<db-url>').split(encodeURIComponent(password)).join('<pw>')
process.stdout.write(scrub(res.stdout ?? ''))
process.stderr.write(scrub(res.stderr ?? ''))
process.exit(res.status ?? 1)
