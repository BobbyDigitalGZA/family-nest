import { PALETTE_KEYS, type PaletteKey } from '../../ui/palette'

export const asPalette = (c: string): PaletteKey =>
  (PALETTE_KEYS as readonly string[]).includes(c) ? (c as PaletteKey) : 'blue'
