import { familyColumns, wallScale } from './layout'

test('escala entre 1× y 3×', () => {
  expect(wallScale(1280, 800)).toEqual({ scale: 1, orientation: 'landscape' })
  expect(wallScale(3840, 2160).scale).toBe(2.7)
  expect(wallScale(800, 600).scale).toBe(1)
  expect(wallScale(1080, 1920)).toEqual({ scale: 1.35, orientation: 'portrait' })
})
test('columnas por número de miembros', () => {
  expect([1, 4, 6, 7, 9].map((n) => familyColumns(n, 'landscape'))).toEqual([1, 4, 6, 4, 5])
  expect(familyColumns(4, 'portrait')).toBe(2)
})
