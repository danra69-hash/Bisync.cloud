import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  MODE_META,
  MODE_STORAGE_KEY,
  type DeviceProfile,
  type PosMode,
} from './types'

type ModeContextValue = {
  mode: PosMode
  setMode: (mode: PosMode) => void
  deviceProfile: DeviceProfile
  setDeviceProfile: (profile: DeviceProfile) => void
  meta: (typeof MODE_META)[PosMode]
}

const ModeContext = createContext<ModeContextValue | null>(null)

function readStoredMode(): PosMode {
  try {
    const raw = localStorage.getItem(MODE_STORAGE_KEY)
    if (raw === 'order' || raw === 'cashier' || raw === 'kiosk' || raw === 'boh')
      return raw
  } catch {
    /* ignore */
  }
  return 'order'
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<PosMode>(readStoredMode)
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile>(
    () => MODE_META[readStoredMode()].devices[0],
  )

  function setMode(next: PosMode) {
    setModeState(next)
    setDeviceProfile(MODE_META[next].devices[0])
  }

  useEffect(() => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [mode])

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        deviceProfile,
        setDeviceProfile,
        meta: MODE_META[mode],
      }}
    >
      {children}
    </ModeContext.Provider>
  )
}

export function usePosMode() {
  const ctx = useContext(ModeContext)
  if (!ctx) throw new Error('usePosMode must be used within ModeProvider')
  return ctx
}
