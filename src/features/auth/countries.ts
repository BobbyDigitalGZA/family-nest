const NOT_COUNTRIES = new Set(['EU', 'UN', 'EZ', 'XA', 'XB', 'ZZ', 'QO'])

export interface CountryOption {
  code: string
  name: string
}

/** Todos los países que el navegador conoce, con su nombre en español, sin mantener una lista a mano. */
export function countryOptions(): CountryOption[] {
  const names = new Intl.DisplayNames(['es'], { type: 'region', fallback: 'none' })
  const out: CountryOption[] = []
  const A = 65
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i, A + j)
      if (NOT_COUNTRIES.has(code)) continue
      const name = names.of(code)
      if (name && name !== code) out.push({ code, name })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Zonas horarias del navegador, con la suya primero si no figura en la lista. */
export function timeZoneOptions(current: string): string[] {
  const all = Intl.supportedValuesOf('timeZone')
  return current && !all.includes(current) ? [current, ...all] : all
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
