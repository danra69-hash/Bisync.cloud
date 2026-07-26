import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * When a user-driven condition changes, drop cached queries so screens
 * always re-hit the API with the new filter values.
 *
 * Skip the first render (initial mount / hydration) to avoid a double fetch.
 */
export function useInvalidateOnChange(
  key: string,
  value: unknown,
  options?: { enabled?: boolean },
) {
  const qc = useQueryClient()
  const enabled = options?.enabled !== false
  const prev = useRef<{ ready: boolean; value: unknown }>({
    ready: false,
    value,
  })

  useEffect(() => {
    if (!enabled) return
    if (!prev.current.ready) {
      prev.current = { ready: true, value }
      return
    }
    if (Object.is(prev.current.value, value)) return
    prev.current.value = value
    void qc.invalidateQueries()
  }, [key, value, enabled, qc])
}
