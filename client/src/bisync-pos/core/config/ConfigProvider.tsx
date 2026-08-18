import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  loadQrTableMode,
  saveQrTableMode,
  type QrTableMode,
} from './qrTable'

type ConfigContextValue = {
  qrTableMode: QrTableMode
  setQrTableMode: (mode: QrTableMode) => void
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [qrTableMode, setQrTableModeState] = useState<QrTableMode>(loadQrTableMode)

  function setQrTableMode(mode: QrTableMode) {
    setQrTableModeState(mode)
  }

  useEffect(() => {
    saveQrTableMode(qrTableMode)
  }, [qrTableMode])

  return (
    <ConfigContext.Provider value={{ qrTableMode, setQrTableMode }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider')
  return ctx
}
