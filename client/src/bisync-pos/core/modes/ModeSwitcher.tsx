import { useNavigate } from 'react-router-dom'
import { MODE_META, type PosMode } from './types'
import { usePosMode } from './ModeProvider'
import './ModeSwitcher.css'

const MODES: PosMode[] = ['order', 'cashier', 'kiosk', 'boh']

type Props = {
  onNavigate?: () => void
}

export function ModeSwitcher({ onNavigate }: Props) {
  const { mode, setMode, meta, deviceProfile, setDeviceProfile } = usePosMode()
  const navigate = useNavigate()

  return (
    <div className="mode-switcher mode-switcher--sidebar">
      <div className="mode-switcher__title">Mode</div>
      <div className="mode-switcher__list" role="tablist" aria-label="POS mode">
        {MODES.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            className={`mode-switcher__item${mode === id ? ' is-active' : ''}`}
            onClick={() => {
              setMode(id)
              navigate(MODE_META[id].homePath)
              onNavigate?.()
            }}
          >
            {MODE_META[id].shortLabel}
          </button>
        ))}
      </div>
      <select
        className="mode-switcher__device"
        aria-label="Device profile"
        value={deviceProfile}
        title={meta.goal}
        onChange={(e) =>
          setDeviceProfile(e.target.value as typeof deviceProfile)
        }
      >
        {meta.devices.map((d) => (
          <option key={d} value={d}>
            {labelDevice(d)}
          </option>
        ))}
      </select>
    </div>
  )
}

function labelDevice(profile: string) {
  return profile
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
