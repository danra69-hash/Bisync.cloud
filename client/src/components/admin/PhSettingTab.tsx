import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { hrApi } from '../../modules/hr/api';
import type { CompanySetting, CountryOption, PublicHoliday } from '../../modules/hr/types';
import { inputCls, selectCls } from '../../data/countries';
import { ToggleSwitch } from './ToggleSwitch';

export function PhSettingTab() {
  const [setting, setSetting] = useState<CompanySetting | null>(null);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [changingCountry, setChangingCountry] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [set, hols, opts] = await Promise.all([
      hrApi.settings.get(),
      hrApi.holidays.list(),
      hrApi.settings.countries(),
    ]);
    setSetting(set);
    setHolidays(hols);
    setCountries(opts);
  }, []);

  useEffect(() => { void load().catch(e => setError(e instanceof Error ? e.message : String(e))); }, [load]);

  const operatingCountryName = countries.find(c => c.countryCode === setting?.operatingCountryCode)?.name
    ?? setting?.operatingCountryCode ?? '—';

  async function changeCountry(code: string) {
    if (!code || code === setting?.operatingCountryCode) return;
    setChangingCountry(true);
    try {
      const updated = await hrApi.settings.update({ operatingCountryCode: code });
      setSetting(updated);
      setHolidays(await hrApi.holidays.list());
    } finally {
      setChangingCountry(false);
    }
  }

  async function toggleHoliday(id: number) {
    const updated = await hrApi.holidays.toggle(id);
    setHolidays(prev => prev.map(h => (h.id === id ? updated : h)));
  }

  async function saveMultiplier(value: number) {
    if (!Number.isFinite(value) || value < 1) return;
    setSetting(await hrApi.settings.update({ publicHolidayPayMultiplier: value }));
  }

  async function toggleReplacementPublicHoliday(enabled: boolean) {
    setSetting(await hrApi.settings.update({ replacementPublicHolidayEnabled: enabled }));
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">{error}</div>
      )}

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="mt-0.5 p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <div>
              <h3 className="text-sm font-semibold">Public Holidays</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Select holidays recognized by your company</p>
            </div>
          </div>
          <div className="min-w-[220px]">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Operating Country</label>
            <select
              className={`${selectCls} mt-1`}
              value={setting?.operatingCountryCode ?? ''}
              onChange={(e) => void changeCountry(e.target.value)}
              disabled={changingCountry}
            >
              {setting?.operatingCountryCode
                && !countries.some(c => c.countryCode === setting.operatingCountryCode) && (
                <option value={setting.operatingCountryCode}>{operatingCountryName}</option>
              )}
              {countries.map(c => (
                <option key={c.countryCode} value={c.countryCode}>{c.name}</option>
              ))}
            </select>
            {changingCountry && <p className="text-[10px] text-muted-foreground mt-1">Loading holidays…</p>}
          </div>
        </div>

        {expanded && (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Holiday</th>
                  <th className="text-left px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-center px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Recognized</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holidays.map(h => (
                  <tr key={h.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{h.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(h.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ToggleSwitch checked={h.isRecognized} onChange={() => void toggleHoliday(h.id)} label={`Recognize ${h.name}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold">Public Holiday Payment Rule</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Configure pay and replacement leave when employees work on recognized public holidays</p>
        </div>

        <div className="flex items-center gap-3 max-w-md">
          <span className="text-xs text-muted-foreground">Base salary ×</span>
          <input
            type="number"
            step="0.1"
            min="1"
            className={`${inputCls} w-28`}
            value={setting?.publicHolidayPayMultiplier ?? 1.5}
            onChange={(e) => void saveMultiplier(parseFloat(e.target.value))}
          />
          <span className="text-[10px] text-muted-foreground">when working on a public holiday</span>
        </div>
        <p className="text-[10px] text-muted-foreground -mt-2">Example: 1.5 = 150% of base salary</p>

        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <ToggleSwitch
              checked={!!setting?.replacementPublicHolidayEnabled}
              onChange={checked => void toggleReplacementPublicHoliday(checked)}
              label="Allow Replacement Public Holiday"
            />
            <span className="text-sm font-medium">Allow Replacement Public Holiday</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            When enabled, employees who work on a recognized public holiday earn Replacement Public Holiday (RPH) balance.
            Accrued RPH days can be taken on another date through a leave request.
          </p>
        </div>
      </div>
    </div>
  );
}
