import { Bell, Building2, GripHorizontal, Menu, Moon, RefreshCw, Search, Sun } from 'lucide-react';

import type { NavItem } from '../../data/revenueManagement';

import type { Company } from '../../api';

import type { DropdownLocation } from '../../utils/orgFilters';

import { LocationDropdown } from '../overview/LocationDropdown';
import { LanguageSelector } from './LanguageSelector';
import { BrandEngineLockup } from './BrandEngineLockup';
import { useAppTranslation } from '../../i18n/useAppTranslation';

const optionStyle = { color: '#1a1a1a', background: '#ffffff' };

type Props = {
  activeNav: NavItem;
  darkMode: boolean;
  editLayout: boolean;
  companies: Company[];
  orgLoading: boolean;
  orgError: string | null;
  onRefreshOrg: () => void;
  selectedCompanyId: number | null;
  locations: DropdownLocation[];
  selectedLocationIds: string[];
  onCompanyChange: (companyId: number | null) => void;
  onLocationChange: (ids: string[]) => void;
  onToggleSidebar: () => void;
  onToggleDark: () => void;
  onToggleEditLayout: () => void;
};

export function Header({
  activeNav, darkMode, editLayout, companies, orgLoading, orgError, onRefreshOrg,
  selectedCompanyId, locations, selectedLocationIds, onCompanyChange, onLocationChange,
  onToggleSidebar, onToggleDark, onToggleEditLayout,
}: Props) {
  const { t, navLabel } = useAppTranslation();
  const selectableCompanies = companies.filter(c => c.active !== false);

  return (
    <header className="sticky top-0 z-30 px-2 sm:px-3 py-2 flex items-center gap-2" style={{ background: '#2C1A0A', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onToggleSidebar} className="p-2 rounded-md hover:bg-white/10">
          <Menu size={16} className="text-white" />
        </button>
        <BrandEngineLockup className="hidden sm:inline-flex" />
      </div>

      <div className="w-px h-5 mx-1 hidden sm:block" style={{ background: 'rgba(255,255,255,0.15)' }} />

      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-bold text-white leading-none">
          {activeNav === 'Overview' ? t('header.operationsOverview') : navLabel(activeNav)}
        </h1>
        <p className="text-xs mt-0.5 hidden sm:block text-white/45">Friday, 20 June 2025 · Dinner service in 3h 24m</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <Building2 size={12} className="text-primary shrink-0" />
          <select
            value={selectedCompanyId ?? ''}
            onChange={(e) => onCompanyChange(e.target.value ? Number(e.target.value) : null)}
            disabled={orgLoading && selectableCompanies.length === 0}
            className="rounded-md px-2 py-1 text-xs font-semibold w-36 sm:w-44 focus:outline-none focus:ring-2 focus:ring-primary text-foreground disabled:opacity-60 bg-card border-2 border-white/35 shadow-sm"
            title={orgError ?? t('header.companiesFromHr')}
          >
            <option value="" style={optionStyle}>
              {orgLoading && selectableCompanies.length === 0 ? t('header.loadingCompanies') : t('header.selectCompany')}
            </option>
            {selectableCompanies.map((c) => (
              <option key={c.id} value={c.id} style={optionStyle}>{c.name}</option>
            ))}
          </select>
        </div>

        <LocationDropdown
          locations={locations}
          selected={selectedLocationIds}
          onChange={onLocationChange}
          variant="header"
          disabled={!selectedCompanyId}
          loading={orgLoading && !!selectedCompanyId && locations.length === 0}
        />

        {(orgError || (orgLoading && selectableCompanies.length === 0)) && (
          <button
            onClick={onRefreshOrg}
            className="p-2 rounded-md hover:bg-white/10"
            title={orgError ?? t('header.reloadOrg')}
          >
            <RefreshCw size={13} className={`text-primary ${orgLoading ? 'animate-spin' : ''}`} />
          </button>
        )}

        <div className="relative hidden md:block">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            placeholder={t('common.search')}
            className="rounded-md pl-8 pr-4 py-1.5 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-primary text-white"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
          />
        </div>

        <button onClick={onToggleDark} className="p-2 rounded-md hover:bg-white/10" title={darkMode ? t('header.lightMode') : t('header.darkMode')}>
          {darkMode ? <Sun size={15} className="text-primary" /> : <Moon size={15} className="text-white/70" />}
        </button>

        {activeNav === 'Overview' && (
          <button
            onClick={onToggleEditLayout}
            className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-md transition-colors"
            style={editLayout ? { background: '#E87722', color: '#2C1A0A' } : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            <GripHorizontal size={11} /> {editLayout ? t('header.editing') : t('header.editLayout')}
          </button>
        )}

        <button className="relative p-2 rounded-md hover:bg-white/10" title={t('header.notifications')}>
          <Bell size={14} className="text-white/70" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>

        <LanguageSelector />
      </div>
    </header>
  );
}
