/** Derive a short outlet initial (e.g. WBPV) from location name / external id. */
export function outletInitialFromLocation(name: string, externalId = ''): string {
  const trimmed = name.trim()
  if (/^[A-Za-z0-9]{2,8}$/.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  const words = trimmed.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (words.length >= 2) {
    const initials = words.map(w => w[0]!).join('').toUpperCase()
    if (initials.length >= 2) return initials.slice(0, 8)
  }

  const fromId = externalId.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (fromId.length >= 2) return fromId.slice(0, 8)

  const compact = trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return (compact || 'OUT').slice(0, 8)
}
