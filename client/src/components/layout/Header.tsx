import { Building2, GripHorizontal, Home, Menu, Moon, RefreshCw, Search, Sun } from 'lucide-react';

import type { NavItem } from '../../data/revenueManagement';

import type { Company } from '../../api';

import type { DropdownLocation } from '../../utils/orgFilters';

import { LocationDropdown } from '../overview/LocationDropdown';
import { LanguageSelector } from './LanguageSelector';
import { Bisync101Button } from '../bisync101/Bisync101Button';
import { BrandEngineLockup } from './BrandEngineLockup';
import { NotificationBell } from './NotificationBell';
import { HeaderOrgClock } from './HeaderOrgClock';
import { PlatformScreenshotShare } from './PlatformScreenshotShare';
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
  onGoHome: () => void;
  onToggleDark: () => void;
  onToggleEditLayout: () => void;
  onOpenBisync101: () => void;
};

export function Header({
  activeNav, darkMode, editLayout, companies, orgLoading, orgError, onRefreshOrg,
  selectedCompanyId, locations, selectedLocationIds, onCompanyChange, onLocationChange,
  onToggleSidebar, onGoHome, onToggleDark, onToggleEditLayout, onOpenBisync101,
}: Props) {
  const { t, navLabel } = useAppTranslation();
  const selectableCompanies = companies.filter(c => c.active !== false);

  return (
    <header className="shrink-0 z-30 px-2 sm:px-3 py-2 flex items-center gap-2" style={{ background: '#2A2118', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onToggleSidebar} className="p-2 rounded-md hover:bg-white/10">
          <Menu size={16} className="text-white" />
        </button>
        <BrandEngineLockup className="hidden sm:inline-flex" />
      </div>

      <div className="w-px h-5 mx-1 hidden sm:block" style={{ background: 'rgba(255,255,255,0.15)' }} />

      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-bold text-white leading-none">
          {activeNav === 'Home' ? t('nav.home') : navLabel(activeNav)}
        </h1>
        <HeaderOrgClock
          companies={companies}
          selectedCompanyId={selectedCompanyId}
          locations={locations}
          selectedLocationIds={selectedLocationIds}
        />
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
            <RefreshCw size={13} className="text-primary" />
          </button>
        )}

        <div className="relative hidden md:block" title={t('common.comingSoon')}>
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            placeholder={t('common.search')}
            disabled
            readOnly
            aria-disabled="true"
            className="rounded-md pl-8 pr-4 py-1.5 text-xs w-40 text-white/50 cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          />
        </div>

        <button
          type="button"
          onClick={onGoHome}
          className="p-2 rounded-md hover:bg-white/10"
          title={t('header.home')}
          aria-label={t('header.home')}
        >
          <Home size={15} className={activeNav === 'Home' ? 'text-primary' : 'text-white/70'} />
        </button>

        <button onClick={onToggleDark} className="p-2 rounded-md hover:bg-white/10" title={darkMode ? t('header.lightMode') : t('header.darkMode')}>
          {darkMode ? <Sun size={15} className="text-primary" /> : <Moon size={15} className="text-white/70" />}
        </button>

        {activeNav === 'Revenue Management' && (
          <button
            onClick={onToggleEditLayout}
            className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-md transition-colors"
            style={editLayout ? { background: '#F37021', color: '#FFFFFF' } : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            <GripHorizontal size={11} /> {editLayout ? t('header.editing') : t('header.editLayout')}
          </button>
        )}

        <NotificationBell />

        <PlatformScreenshotShare />

        <LanguageSelector />

        <Bisync101Button onClick={onOpenBisync101} />
      </div>
    </header>
  );
}
