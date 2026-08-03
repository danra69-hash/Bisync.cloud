/** Deep-clone for POS floor plans without requiring structuredClone (older WebViews). */
export function cloneJson<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T
}
