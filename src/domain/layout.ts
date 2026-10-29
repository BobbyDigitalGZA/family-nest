export type Orientation = 'landscape' | 'portrait'

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v))

/** Wall screen scale from a 1280 × 800 base (rotated in portrait), clamped to 1×–3×. */
export function wallScale(
  width: number,
  height: number,
): { scale: number; orientation: Orientation } {
  const landscape = width >= height
  const raw = landscape
    ? Math.min(width / 1280, height / 800)
    : Math.min(width / 800, height / 1280)
  return {
    scale: Math.round(clamp(raw, 1, 3) * 100) / 100,
    orientation: landscape ? 'landscape' : 'portrait',
  }
}

export function familyColumns(members: number, orientation: Orientation): number {
  if (orientation === 'portrait') return Math.min(members, 2)
  return members <= 6 ? members : Math.ceil(members / 2)
}
