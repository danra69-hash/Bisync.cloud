import { useEffect, useMemo, useState } from 'react';
import { Cloud, HardDrive, Search } from 'lucide-react';
import { api, type Vendor, type VendorRatingSummary } from '../../api';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { filterSelectCls } from '../layout/formControls';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { ColGroup } from '../shared/SortableTableHead';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';
import { VendorRatingDetailPage } from './VendorRatingDetailPage';
import {
  formatOverallRating,
  moodFaceChar,
  moodFaceColorClass,
  moodFaceLabel,
  moodFromAverage,
  vendorKindLabel,
  VENDOR_RATING_LEVELS,
  type RatingMood,
} from '../../data/vendorRating';

type KindFilter = 'all' | 'online' | 'offline';

function MoodCell({ mood, score }: { mood: RatingMood; score: number | null | undefined }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${moodFaceColorClass(mood)}`}
      title={moodFaceLabel(mood)}
    >
      <span className="text-base leading-none" aria-hidden>{moodFaceChar(mood)}</span>
      <span className="text-xs font-sans tabular-nums font-medium text-foreground">
        {formatOverallRating(score)}
      </span>
    </span>
  );
}

export function VendorRatingConfigPage({
  selectedCompanyId,
  selectedLocationIds,
}: {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
}) {
  useRevMgmtPageLabel('Vendor Rating Config');

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [summaries, setSummaries] = useState<VendorRatingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [vendorRows, ratingRows] = await Promise.all([
        api.vendors(undefined, selectedCompanyId ?? undefined),
        api.vendorRatingSummaries(),
      ]);
      setVendors(Array.isArray(vendorRows) ? vendorRows : []);
      setSummaries(Array.isArray(ratingRows) ? ratingRows : []);
    } catch (err) {
      setVendors([]);
      setSummaries([]);
      setError(err instanceof Error ? err.message : 'Unable to load vendor ratings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [selectedCompanyId, selectedLocationIds.join(',')]);

  const summaryById = useMemo(() => {
    const map = new Map<string, VendorRatingSummary>();
    for (const row of summaries) {
      map.set(row.vendorExternalId, row);
    }
    return map;
  }, [summaries]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors
      .filter(v => {
        if (kindFilter === 'online' && (v.type ?? '').toLowerCase() !== 'online') return false;
        if (kindFilter === 'offline' && (v.type ?? '').toLowerCase() === 'online') return false;
        if (!q) return true;
        return v.name.toLowerCase().includes(q)
          || (v.externalId ?? '').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.engaged !== b.engaged) return a.engaged ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [vendors, search, kindFilter]);

  const ratedCount = useMemo(
    () => rows.filter(v => summaryById.get(v.externalId)?.hasRating).length,
    [rows, summaryById],
  );

  return (
    <div className={pageShellClass()}>
      <PageStickyFilters>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1 max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendors…"
              className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
          <select
            value={kindFilter}
            onChange={e => setKindFilter(e.target.value as KindFilter)}
            className={filterSelectCls}
            aria-label="Vendor kind"
          >
            <option value="all">All types</option>
            <option value="online">Online (Cloud)</option>
            <option value="offline">Offline (Virtual)</option>
          </select>
          <span className="text-[11px] text-muted-foreground font-sans">
            {ratedCount}/{rows.length} rated
          </span>
        </div>
      </PageStickyFilters>

      <div className="px-2 sm:px-3 pb-3 space-y-3">
        <section className="rounded-lg border border-border bg-card p-3 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Rating model</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              How Bisync scores vendors. Ratings collected on Receive / Consolidate feed customer-input averages.
              Online vendors also include order acceptance, PO acceptance, and product accuracy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-md border border-border bg-muted/10 px-3 py-2.5 space-y-2">
              <p className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                Customer input levels
              </p>
              <ul className="space-y-1">
                {VENDOR_RATING_LEVELS.map(level => (
                  <li key={level.id} className="flex items-center justify-between gap-2 text-xs">
                    <span>{level.label}</span>
                    <span className="font-sans tabular-nums text-muted-foreground">{level.score}%</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-muted-foreground">
                Product quality and hygiene on receive/consolidate (optional).
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/10 px-3 py-2.5 space-y-2">
              <p className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                Mood thresholds
              </p>
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-center justify-between gap-2">
                  <span className={moodFaceColorClass('green')}>
                    <span aria-hidden>{moodFaceChar('green')}</span> Good
                  </span>
                  <span className="text-muted-foreground font-sans">80–100%</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className={moodFaceColorClass('yellow')}>
                    <span aria-hidden>{moodFaceChar('yellow')}</span> Fair
                  </span>
                  <span className="text-muted-foreground font-sans">50–79%</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className={moodFaceColorClass('red')}>
                    <span aria-hidden>{moodFaceChar('red')}</span> Poor
                  </span>
                  <span className="text-muted-foreground font-sans">Below 50%</span>
                </li>
              </ul>
            </div>

            <div className="rounded-md border border-border bg-muted/10 px-3 py-2.5 space-y-2">
              <p className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                Vendor kinds
              </p>
              <div className="space-y-2 text-xs">
                <p className="flex items-start gap-2">
                  <Cloud size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                  <span>
                    <strong className="font-semibold">Online</strong>
                    {' '}— Bisync Cloud vendor. Control is with the vendor; timing &amp; accuracy auto-score.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <HardDrive size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                  <span>
                    <strong className="font-semibold">Offline</strong>
                    {' '}— Virtual vendor. Operator can set delivery, accuracy, quality, and hygiene.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Vendor ratings</h3>
            <button
              type="button"
              onClick={() => void load()}
              className="text-[11px] font-medium text-primary hover:underline"
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-6">
              <MillstoneLoader size="sm" layout="block" label="Loading vendor ratings…" />
            </div>
          ) : (
            <TableScrollContainer>
              <table className="w-full border-collapse text-xs">
                <ColGroup
                  widths={['28%', '14%', '12%', '14%', '16%', '16%']}
                />
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2 font-sans uppercase tracking-wide text-[10px] text-muted-foreground">
                      Vendor
                    </th>
                    <th className="text-left px-3 py-2 font-sans uppercase tracking-wide text-[10px] text-muted-foreground">
                      Kind
                    </th>
                    <th className="text-center px-3 py-2 font-sans uppercase tracking-wide text-[10px] text-muted-foreground">
                      Engaged
                    </th>
                    <th className="text-center px-3 py-2 font-sans uppercase tracking-wide text-[10px] text-muted-foreground">
                      Overall
                    </th>
                    <th className="text-left px-3 py-2 font-sans uppercase tracking-wide text-[10px] text-muted-foreground">
                      Control
                    </th>
                    <th className="text-right px-3 py-2 font-sans uppercase tracking-wide text-[10px] text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                        No vendors match this filter.
                      </td>
                    </tr>
                  ) : (
                    rows.map(vendor => {
                      const summary = summaryById.get(vendor.externalId);
                      const mood = moodFromAverage(summary?.overallRating ?? null);
                      const kind = vendorKindLabel(vendor.type);
                      return (
                        <tr key={vendor.id} className="border-b border-border/60 hover:bg-muted/20">
                          <td className="px-3 py-2">
                            <div className="font-medium text-foreground">{vendor.name}</div>
                            <div className="text-[10px] text-muted-foreground font-sans">
                              {vendor.externalId}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              {(vendor.type ?? '').toLowerCase() === 'online'
                                ? <Cloud size={12} />
                                : <HardDrive size={12} />}
                              {kind}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {vendor.engaged ? (
                              <span className="text-[#5A7A2A] font-medium">Yes</span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <MoodCell mood={mood} score={summary?.overallRating} />
                          </td>
                          <td className="px-3 py-2 text-muted-foreground capitalize">
                            {summary?.control || ((vendor.type ?? '').toLowerCase() === 'online' ? 'vendor' : 'operator')}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedVendor(vendor)}
                              className="px-2.5 py-1 rounded-md border border-border text-[11px] font-semibold hover:bg-muted/50"
                            >
                              Open rating
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </TableScrollContainer>
          )}
        </section>
      </div>

      {selectedVendor ? (
        <VendorRatingDetailPage
          vendor={selectedVendor}
          selectedCompanyId={selectedCompanyId}
          onClose={() => {
            setSelectedVendor(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
