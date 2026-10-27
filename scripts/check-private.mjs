// Busca las entradas de .private-names.local (palabra completa, sin tildes ni
// mayusculas) en los archivos que sigue git. Nunca imprime la entrada.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const LIST = '.private-names.local'

export const normalize = (s) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function buildMatchers(entries) {
  return entries.map(
    (e) =>
      new RegExp(`(?<![\\p{L}\\p{N}_])${escape(e)}(?![\\p{L}\\p{N}_])`, 'u'),
  )
}

export function findHits(text, matchers) {
  const hits = []
  normalize(text)
    .split('\n')
    .forEach((line, i) => {
      if (matchers.some((m) => m.test(line))) hits.push(i + 1)
    })
  return hits
}

function main() {
  if (!existsSync(LIST)) {
    console.warn(`check:private: no existe ${LIST}; se omite la revision.`)
    return 0
  }
  const entries = readFileSync(LIST, 'utf8')
    .split(/\r?\n/)
    .map((l) => normalize(l.trim()))
    .filter((l) => l && !l.startsWith('#'))
  const matchers = buildMatchers(entries)
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
  let found = 0
  for (const file of files) {
    if (!existsSync(file)) continue
    const buf = readFileSync(file)
    if (buf.includes(0)) continue
    for (const line of findHits(buf.toString('utf8'), matchers)) {
      console.error(`${file}:${line}`)
      found++
    }
  }
  if (found) {
    console.error(`check:private: ${found} coincidencia(s) con datos privados.`)
    return 1
  }
  console.log('check:private: sin coincidencias.')
  return 0
}

import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main())
