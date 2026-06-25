import { Bell, GripHorizontal, Menu, Moon, Search, Sun } from 'lucide-react';
import type { NavItem } from '../../data/revenueManagement';
import type { Location } from '../../api';
import { LocationDropdown } from '../overview/LocationDropdown';

type Props = {
  activeNav: NavItem;
  darkMode: boolean;
  editLayout: boolean;
  locations: Location[];
  selectedLocationIds: string[];
  onLocationChange: (ids: string[]) => void;
  onToggleSidebar: () => void;
  onToggleDark: () => void;
  onToggleEditLayout: () => void;
};

export function Header({
  activeNav, darkMode, editLayout, locations, selectedLocationIds, onLocationChange,
  onToggleSidebar, onToggleDark, onToggleEditLayout,
}: Props) {
  return (
    <header className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3" style={{ background: '#2C1A0A', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onToggleSidebar} className="p-2 rounded-md hover:bg-white/10">
          <Menu size={16} className="text-white" />
        </button>
        <span className="text-white font-bold text-sm hidden sm:inline">Bisync.cloud</span>
      </div>

      <div className="w-px h-5 mx-1 hidden sm:block" style={{ background: 'rgba(255,255,255,0.15)' }} />

      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-bold text-white leading-none">
          {activeNav === 'Overview' ? 'Operations Overview' : activeNav}
        </h1>
        <p className="text-[10px] mt-0.5 hidden sm:block text-white/45">Friday, 20 June 2025 · Dinner service in 3h 24m</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden md:block">
          <LocationDropdown
            locations={locations}
            selected={selectedLocationIds}
            onChange={onLocationChange}
            variant="header"
          />
        </div>

        <div className="relative hidden md:block">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            placeholder="Search…"
            className="rounded-md pl-8 pr-4 py-1.5 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-primary text-white"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
          />
        </div>

        <button onClick={onToggleDark} className="p-2 rounded-md hover:bg-white/10" title={darkMode ? 'Light mode' : 'Dark mode'}>
          {darkMode ? <Sun size={15} className="text-primary" /> : <Moon size={15} className="text-white/70" />}
        </button>

        {activeNav === 'Overview' && (
          <button
            onClick={onToggleEditLayout}
            className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-md transition-colors"
            style={editLayout ? { background: '#E87722', color: '#2C1A0A' } : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            <GripHorizontal size={11} /> {editLayout ? 'Editing' : 'Edit Layout'}
          </button>
        )}

        <button className="relative p-2 rounded-md hover:bg-white/10">
          <Bell size={14} className="text-white/70" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>
      </div>
    </header>
  );
}
