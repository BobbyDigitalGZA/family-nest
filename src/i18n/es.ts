export const es = {
  appName: 'Family Nest',
  createdBy: 'Creada por {nickname}',
}

export function t(
  key: keyof typeof es,
  vars?: Record<string, string | number>,
): string {
  const text = es[key]
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}
