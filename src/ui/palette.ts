import { t } from '../i18n/es'

// Para sumar colores aprobados: agregar la clave aquí, su nombre en es.ts
// y sus variables en tokens.css.
export const PALETTE_KEYS = ['blue', 'pink', 'lilac', 'green'] as const
export type PaletteKey = (typeof PALETTE_KEYS)[number]

const NAME_KEYS = {
  blue: 'colorBlue',
  pink: 'colorPink',
  lilac: 'colorLilac',
  green: 'colorGreen',
} as const satisfies Record<PaletteKey, string>

export function paletteName(key: PaletteKey): string {
  return t(NAME_KEYS[key])
}
