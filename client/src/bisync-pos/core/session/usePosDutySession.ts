import { useCallback, useEffect, useState } from 'react'
import {
  loadPosDutySession,
  POS_DUTY_SESSION_EVENT,
  type PosDutySession,
} from './posDutySession'
import { syncPosDutyWithHrAttendance } from './posDutySync'

/** Local POS duty session, refreshed from storage and reconciled with HR attendance. */
export function usePosDutySession() {
  const [duty, setDuty] = useState<PosDutySession | null>(() => loadPosDutySession())

  const refresh = useCallback(async () => {
    const next = await syncPosDutyWithHrAttendance()
    setDuty(next)
    return next
  }, [])

  useEffect(() => {
    function onLocalChange() {
      setDuty(loadPosDutySession())
      void refresh()
    }
    window.addEventListener(POS_DUTY_SESSION_EVENT, onLocalChange)
    window.addEventListener('storage', onLocalChange)
    return () => {
      window.removeEventListener(POS_DUTY_SESSION_EVENT, onLocalChange)
      window.removeEventListener('storage', onLocalChange)
    }
  }, [refresh])

  useEffect(() => {
    void refresh()

    function onVisible() {
      if (document.visibilityState === 'visible') void refresh()
    }
    function onFocus() {
      void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    const id = window.setInterval(() => void refresh(), 15_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.clearInterval(id)
    }
  }, [refresh])

  return { duty, setDuty, refreshDuty: refresh }
}
